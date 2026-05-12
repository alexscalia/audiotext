import { readFileSync } from "node:fs";
import { and, eq, isNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";
import type { VoiceNumberingPlanDestinationType } from "./schema.js";

const DESTINATION_TYPES = new Set<VoiceNumberingPlanDestinationType>(
  schema.voiceNumberingPlanDestinationType.enumValues,
);

const CURRENCY_ISO = "USD";

type RateBucket = {
  countryIso2: string;
  name: string;
  type: VoiceNumberingPlanDestinationType;
  ratePerMin: number;
  minDurationSec: number;
  incrementSec: number;
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

    const ratePerMin = Number.parseFloat(cells[10]!);
    const minDurationSec = Number.parseInt(cells[11]!, 10);
    const incrementSec = Number.parseInt(cells[12]!, 10);
    const setupFee = Number.parseFloat(cells[13]!);

    if (!Number.isFinite(ratePerMin) || ratePerMin < 0) {
      throw new Error(`csv row ${i + 1}: invalid Rate Per Min "${cells[10]}"`);
    }
    if (!Number.isFinite(minDurationSec) || minDurationSec < 0) {
      throw new Error(
        `csv row ${i + 1}: invalid Min Duration Sec "${cells[11]}"`,
      );
    }
    if (!Number.isFinite(incrementSec) || incrementSec <= 0) {
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
        ratePerMin,
        minDurationSec,
        incrementSec,
        setupFee,
      });
    } else {
      existing.ratePerMin = Math.max(existing.ratePerMin, ratePerMin);
      existing.minDurationSec = Math.min(
        existing.minDurationSec,
        minDurationSec,
      );
      existing.incrementSec = Math.min(existing.incrementSec, incrementSec);
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
        ratePerMin: row.ratePerMin,
        minDurationSec: row.minDurationSec,
        incrementSec: row.incrementSec,
        setupFee: row.setupFee,
      };
      mergedByCountry.set(row.countryIso2, merged);
      result.push(merged);
      continue;
    }
    existing.ratePerMin = Math.max(existing.ratePerMin, row.ratePerMin);
    existing.minDurationSec = Math.min(
      existing.minDurationSec,
      row.minDurationSec,
    );
    existing.incrementSec = Math.min(existing.incrementSec, row.incrementSec);
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
): Promise<string> {
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
    throw new Error(
      `rate sheet "${name}" already exists; clean up before re-seeding`,
    );
  }

  const [created] = await db
    .insert(schema.voiceRateSheets)
    .values({
      name,
      status: "active",
      voiceNumberingPlanId: planId,
      currencyIso: CURRENCY_ISO,
    })
    .returning({ id: schema.voiceRateSheets.id });
  if (!created) throw new Error(`failed to create rate sheet ${name}`);
  return created.id;
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
  buckets: RateBucket[],
): Promise<void> {
  const planId = await getPlanId(db, planName);
  const sheetId = await ensureRateSheet(db, sheetName, planId);

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
      ratePerMin: bucket.ratePerMin.toFixed(6),
      minDurationSec: bucket.minDurationSec,
      incrementSec: bucket.incrementSec,
      setupFee: bucket.setupFee.toFixed(6),
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

  await seedSheet(db, "Extended", "Extended", extended);
  await seedSheet(db, "Simplified", "Simplified", simplified);
}
