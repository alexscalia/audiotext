import { readFileSync } from "node:fs";
import { and, eq, isNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";
import type { Currency, VoiceNumberingPlanDestinationType } from "./schema.js";

const DESTINATION_TYPES = new Set<VoiceNumberingPlanDestinationType>(
  schema.voiceNumberingPlanDestinationType.enumValues,
);

const USD_TO_EUR = 0.86;

type RateBucket = {
  countryIso2: string;
  name: string;
  type: VoiceNumberingPlanDestinationType;
  ratePerMinute: number;
  minDurationSeconds: number;
  incrementSeconds: number;
  setupFee: number;
};

function parseRateRows(): RateBucket[] {
  const text = readFileSync(
    new URL("../../../numbering_plan.csv", import.meta.url),
    "utf8",
  );
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  const buckets = new Map<string, RateBucket>();

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i]!.split(",").map((c) => c.trim());
    if (cells.length < 14) {
      throw new Error(
        `csv row ${i + 1}: expected 14 columns, got ${cells.length}`,
      );
    }
    const iso2 = cells[1]!.toUpperCase();
    const name = cells[2]!;
    const typeRaw = cells[9]!.toLowerCase();
    if (!iso2 || !name) continue;

    if (!DESTINATION_TYPES.has(typeRaw as VoiceNumberingPlanDestinationType)) {
      throw new Error(
        `csv row ${i + 1}: unknown destination type "${typeRaw}"`,
      );
    }
    const type = typeRaw as VoiceNumberingPlanDestinationType;

    const ratePerMinute = Number.parseFloat(cells[10]!);
    const minDurationSeconds = Number.parseInt(cells[11]!, 10);
    const incrementSeconds = Number.parseInt(cells[12]!, 10);
    const setupFee = Number.parseFloat(cells[13]!);

    if (!Number.isFinite(ratePerMinute) || ratePerMinute < 0) {
      throw new Error(`csv row ${i + 1}: invalid Rate Per Min "${cells[10]}"`);
    }
    if (!Number.isFinite(minDurationSeconds) || minDurationSeconds < 0) {
      throw new Error(
        `csv row ${i + 1}: invalid Min Duration Sec "${cells[11]}"`,
      );
    }
    if (!Number.isFinite(incrementSeconds) || incrementSeconds <= 0) {
      throw new Error(`csv row ${i + 1}: invalid Increment Sec "${cells[12]}"`);
    }
    if (!Number.isFinite(setupFee) || setupFee < 0) {
      throw new Error(`csv row ${i + 1}: invalid Setup Fee "${cells[13]}"`);
    }

    const key = `${iso2}|${name}`;
    const existing = buckets.get(key);
    if (!existing) {
      buckets.set(key, {
        countryIso2: iso2,
        name,
        type,
        ratePerMinute,
        minDurationSeconds,
        incrementSeconds,
        setupFee,
      });
    } else {
      existing.ratePerMinute = Math.max(existing.ratePerMinute, ratePerMinute);
      existing.minDurationSeconds = Math.min(
        existing.minDurationSeconds,
        minDurationSeconds,
      );
      existing.incrementSeconds = Math.min(
        existing.incrementSeconds,
        incrementSeconds,
      );
      existing.setupFee = Math.max(existing.setupFee, setupFee);
    }
  }

  return [...buckets.values()];
}

function buildSimplifiedRateBuckets(rateRows: RateBucket[]): RateBucket[] {
  const result: RateBucket[] = [];
  const mergedByCountry = new Map<string, RateBucket>();

  for (const row of rateRows) {
    if (row.type !== "mobile") {
      result.push(row);
      continue;
    }
    const existing = mergedByCountry.get(row.countryIso2);
    if (!existing) {
      const merged: RateBucket = {
        countryIso2: row.countryIso2,
        name: "Mobile",
        type: "mobile",
        ratePerMinute: row.ratePerMinute,
        minDurationSeconds: row.minDurationSeconds,
        incrementSeconds: row.incrementSeconds,
        setupFee: row.setupFee,
      };
      mergedByCountry.set(row.countryIso2, merged);
      result.push(merged);
      continue;
    }
    existing.ratePerMinute = Math.max(existing.ratePerMinute, row.ratePerMinute);
    existing.minDurationSeconds = Math.min(
      existing.minDurationSeconds,
      row.minDurationSeconds,
    );
    existing.incrementSeconds = Math.min(
      existing.incrementSeconds,
      row.incrementSeconds,
    );
    existing.setupFee = Math.max(existing.setupFee, row.setupFee);
  }

  return result;
}

async function getPlanId(
  db: NodePgDatabase<typeof schema>,
  name: string,
): Promise<string> {
  const [row] = await db
    .select()
    .from(schema.voiceNumberingPlans)
    .where(
      and(
        eq(schema.voiceNumberingPlans.name, name),
        isNull(schema.voiceNumberingPlans.deletedAt),
      ),
    )
    .limit(1);
  if (!row)
    throw new Error(
      `numbering plan "${name}" not found; run seedVoiceNumberingPlan first`,
    );
  return row.id;
}

async function ensureRateSheet(
  db: NodePgDatabase<typeof schema>,
  name: string,
  planId: string,
  currency: Currency,
): Promise<{ id: string; created: boolean }> {
  const [existing] = await db
    .select()
    .from(schema.voiceRateSheets)
    .where(
      and(
        eq(schema.voiceRateSheets.name, name),
        isNull(schema.voiceRateSheets.deletedAt),
      ),
    )
    .limit(1);
  if (existing) {
    return { id: existing.id, created: false };
  }

  const [created] = await db
    .insert(schema.voiceRateSheets)
    .values({
      name,
      status: "active",
      voiceNumberingPlanId: planId,
      currency,
    })
    .returning({ id: schema.voiceRateSheets.id });
  if (!created) throw new Error(`failed to create rate sheet ${name}`);
  return { id: created.id, created: true };
}

async function getDestinationId(
  db: NodePgDatabase<typeof schema>,
  planId: string,
  iso2: string,
  name: string,
): Promise<string> {
  const [row] = await db
    .select()
    .from(schema.voiceNumberingPlanDestinations)
    .where(
      and(
        eq(schema.voiceNumberingPlanDestinations.voiceNumberingPlanId, planId),
        eq(schema.voiceNumberingPlanDestinations.countryIso2, iso2),
        eq(schema.voiceNumberingPlanDestinations.name, name),
        isNull(schema.voiceNumberingPlanDestinations.deletedAt),
      ),
    )
    .limit(1);
  if (!row)
    throw new Error(`destination not found in plan ${planId}: ${iso2}/${name}`);
  return row.id;
}

async function seedSheet(
  db: NodePgDatabase<typeof schema>,
  sheetName: string,
  planName: string,
  currency: Currency,
  buckets: RateBucket[],
  rateMultiplier: number,
): Promise<void> {
  const planId = await getPlanId(db, planName);
  const { id: sheetId, created } = await ensureRateSheet(
    db,
    sheetName,
    planId,
    currency,
  );
  if (!created) {
    console.log(`rate sheet "${sheetName}" already seeded — skipping lines`);
    return;
  }

  let inserted = 0;
  for (const bucket of buckets) {
    const destinationId = await getDestinationId(
      db,
      planId,
      bucket.countryIso2,
      bucket.name,
    );
    await db.insert(schema.voiceRateSheetLines).values({
      voiceRateSheetId: sheetId,
      voiceNumberingPlanDestinationId: destinationId,
      ratePerMinute: (bucket.ratePerMinute * rateMultiplier).toFixed(6),
      minDurationSeconds: bucket.minDurationSeconds,
      incrementSeconds: bucket.incrementSeconds,
      setupFee: (bucket.setupFee * rateMultiplier).toFixed(6),
    });
    inserted += 1;
  }

  console.log(`seeded rate sheet "${sheetName}": ${inserted} lines`);
}

export async function seedVoiceRateSheets(
  db: NodePgDatabase<typeof schema>,
): Promise<void> {
  const extended = parseRateRows();
  const simplified = buildSimplifiedRateBuckets(extended);

  await seedSheet(db, "Extended USD", "Extended", "usd", extended, 1);
  await seedSheet(db, "Simplified USD", "Simplified", "usd", simplified, 1);
  await seedSheet(db, "Extended EUR", "Extended", "eur", extended, USD_TO_EUR);
  await seedSheet(
    db,
    "Simplified EUR",
    "Simplified",
    "eur",
    simplified,
    USD_TO_EUR,
  );
}
