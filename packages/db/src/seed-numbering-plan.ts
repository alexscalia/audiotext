import { readFileSync } from "node:fs";
import { and, eq, isNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";
import type { NumberingPlanDestinationType } from "./schema.js";

const PLAN_NAME = "Main";

const DESTINATION_TYPES = new Set<NumberingPlanDestinationType>(
  schema.numberingPlanDestinationType.enumValues,
);

type Fixture = {
  countryCode: string;
  name: string;
  minDigits: number;
  maxDigits: number;
  type: NumberingPlanDestinationType | null;
  website: string | null;
  codes: Set<string>;
};

function parseRows(): Fixture[] {
  const text = readFileSync(
    new URL("../../../numbering_plan.csv", import.meta.url),
    "utf8",
  );
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const fixtures = new Map<string, Fixture>();

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i]!.split(",").map((c) => c.trim());
    if (cells.length < 10) continue;
    const iso2 = cells[1]!.toUpperCase();
    const name = cells[2]!;
    const e164 = cells[3]!;
    const sub = cells[4]!;
    const minDigits = Number.parseInt(cells[5]!, 10);
    const maxDigits = Number.parseInt(cells[6]!, 10);
    const website = cells[7]!.length > 0 ? cells[7]! : null;
    const typeRaw = cells[9]!.toLowerCase();
    if (!iso2 || !name) continue;
    if (!Number.isFinite(minDigits) || !Number.isFinite(maxDigits)) continue;

    const code = (e164 + sub).replace(/\s+/g, "");
    if (code.length === 0 || !/^[0-9]+$/.test(code)) continue;

    const type = DESTINATION_TYPES.has(typeRaw as NumberingPlanDestinationType)
      ? (typeRaw as NumberingPlanDestinationType)
      : null;

    const key = `${iso2}|${name}`;
    let fixture = fixtures.get(key);
    if (!fixture) {
      fixture = {
        countryCode: iso2,
        name,
        minDigits,
        maxDigits,
        type,
        website,
        codes: new Set<string>(),
      };
      fixtures.set(key, fixture);
    }
    fixture.codes.add(code);
  }

  return [...fixtures.values()];
}

async function ensurePlanId(
  db: NodePgDatabase<typeof schema>,
): Promise<string> {
  const existing = await db
    .select()
    .from(schema.numberingPlans)
    .where(
      and(
        eq(schema.numberingPlans.name, PLAN_NAME),
        isNull(schema.numberingPlans.deletedAt),
      ),
    )
    .limit(1);
  if (existing[0]) return existing[0].id;

  const [created] = await db
    .insert(schema.numberingPlans)
    .values({ name: PLAN_NAME, status: "active" })
    .returning({ id: schema.numberingPlans.id });
  if (!created) throw new Error("failed to create numbering plan");
  return created.id;
}

async function ensureDestinationId(
  db: NodePgDatabase<typeof schema>,
  planId: string,
  fixture: Fixture,
): Promise<string> {
  const existing = await db
    .select()
    .from(schema.numberingPlanDestinations)
    .where(
      and(
        eq(schema.numberingPlanDestinations.numberingPlanId, planId),
        eq(schema.numberingPlanDestinations.countryCode, fixture.countryCode),
        eq(schema.numberingPlanDestinations.name, fixture.name),
        isNull(schema.numberingPlanDestinations.deletedAt),
      ),
    )
    .limit(1);
  if (existing[0]) return existing[0].id;

  const [created] = await db
    .insert(schema.numberingPlanDestinations)
    .values({
      numberingPlanId: planId,
      countryCode: fixture.countryCode,
      name: fixture.name,
      type: fixture.type,
      website: fixture.website,
      minDigits: fixture.minDigits,
      maxDigits: fixture.maxDigits,
    })
    .returning({ id: schema.numberingPlanDestinations.id });
  if (!created)
    throw new Error(
      `failed to create destination ${fixture.countryCode}/${fixture.name}`,
    );
  return created.id;
}

async function ensureCode(
  db: NodePgDatabase<typeof schema>,
  destinationId: string,
  code: string,
): Promise<boolean> {
  const existing = await db
    .select()
    .from(schema.numberingPlanCodes)
    .where(
      and(
        eq(schema.numberingPlanCodes.numberingPlanDestinationId, destinationId),
        eq(schema.numberingPlanCodes.code, code),
        isNull(schema.numberingPlanCodes.deletedAt),
      ),
    )
    .limit(1);
  if (existing[0]) return false;

  await db
    .insert(schema.numberingPlanCodes)
    .values({ numberingPlanDestinationId: destinationId, code });
  return true;
}

export async function seedNumberingPlan(
  db: NodePgDatabase<typeof schema>,
): Promise<void> {
  const fixtures = parseRows();
  const planId = await ensurePlanId(db);

  let destinationsInserted = 0;
  let codesInserted = 0;

  for (const fixture of fixtures) {
    const destinationId = await ensureDestinationId(db, planId, fixture);
    destinationsInserted += 1;
    for (const code of fixture.codes) {
      if (await ensureCode(db, destinationId, code)) codesInserted += 1;
    }
  }

  console.log(
    `seeded numbering plan: ${fixtures.length} destinations (${destinationsInserted} ensured), ${codesInserted} codes inserted`,
  );
}
