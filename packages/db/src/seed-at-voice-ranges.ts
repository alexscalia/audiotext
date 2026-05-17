import { and, eq, inArray, isNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";
import type {
  AtVoiceTerminationType,
  NewAtVoiceTerminationRow,
} from "./schema.js";

const TARGET_TOTAL = 1000;
const ASSIGNED_COUNT = 500;
const CARRIER_RATE_FACTOR = 0.75;
const PAYOUT_WEEKLY_MULTIPLIER = 1.15;
const PAYOUT_LONG_TERM_MULTIPLIER = 1.1;
const BILLING_CYCLE_DAYS = 30;
const PAYMENT_TERMS_DAYS = 14;
const INSERT_CHUNK = 200;

const EXTENDED_PLAN = "Extended";
const RATE_SHEET_NAMES = ["Extended USD", "Extended EUR"] as const;

function pad(n: number, width = 4): string {
  return String(n).padStart(width, "0");
}

function pickRandom<T>(arr: readonly T[]): T {
  const idx = Math.floor(Math.random() * arr.length);
  return arr[idx]!;
}

type DailyCaps = {
  maxDailyTotalMinutes: number | null;
  maxDailyMinutesANumber: number | null;
  maxDailyMinutesBNumber: number | null;
  maxDailyMinutesAToBNumber: number | null;
};

function randomInt(minInclusive: number, maxInclusive: number): number {
  return (
    Math.floor(Math.random() * (maxInclusive - minInclusive + 1)) + minInclusive
  );
}

function generateDailyCaps(): DailyCaps {
  if (Math.random() < 0.5) {
    return {
      maxDailyTotalMinutes: null,
      maxDailyMinutesANumber: null,
      maxDailyMinutesBNumber: null,
      maxDailyMinutesAToBNumber: null,
    };
  }
  const total = randomInt(2, 100) * 1000;
  const pctBetween = (lo: number, hi: number) =>
    Math.round((total * (lo + Math.random() * (hi - lo))) / 10) * 10;
  return {
    maxDailyTotalMinutes: total,
    maxDailyMinutesANumber: pctBetween(0.1, 0.2),
    maxDailyMinutesBNumber: pctBetween(0.1, 0.2),
    maxDailyMinutesAToBNumber: pctBetween(0.05, 0.1),
  };
}

export async function seedAtVoiceTerminations(
  db: NodePgDatabase<typeof schema>,
): Promise<void> {
  const existing = await db
    .select({ id: schema.atVoiceTerminations.id })
    .from(schema.atVoiceTerminations)
    .where(isNull(schema.atVoiceTerminations.deletedAt))
    .limit(1);
  if (existing[0]) {
    console.log("at_voice_terminations already seeded — skipping");
    return;
  }

  const [plan] = await db
    .select({ id: schema.voiceNumberingPlans.id })
    .from(schema.voiceNumberingPlans)
    .where(
      and(
        eq(schema.voiceNumberingPlans.name, EXTENDED_PLAN),
        isNull(schema.voiceNumberingPlans.deletedAt),
      ),
    )
    .limit(1);
  if (!plan)
    throw new Error(
      `numbering plan "${EXTENDED_PLAN}" not found; run seedVoiceNumberingPlan first`,
    );

  const destinations = await db
    .select({
      id: schema.voiceNumberingPlanDestinations.id,
      countryIso2: schema.voiceNumberingPlanDestinations.countryIso2,
      name: schema.voiceNumberingPlanDestinations.name,
    })
    .from(schema.voiceNumberingPlanDestinations)
    .where(
      and(
        eq(
          schema.voiceNumberingPlanDestinations.voiceNumberingPlanId,
          plan.id,
        ),
        isNull(schema.voiceNumberingPlanDestinations.deletedAt),
      ),
    );
  if (destinations.length === 0)
    throw new Error(`plan "${EXTENDED_PLAN}" has no destinations`);

  const sheets = await db
    .select({
      id: schema.voiceRateSheets.id,
      name: schema.voiceRateSheets.name,
      currency: schema.voiceRateSheets.currency,
    })
    .from(schema.voiceRateSheets)
    .where(
      and(
        inArray(schema.voiceRateSheets.name, [...RATE_SHEET_NAMES]),
        isNull(schema.voiceRateSheets.deletedAt),
      ),
    );
  if (sheets.length !== RATE_SHEET_NAMES.length) {
    throw new Error(
      `expected rate sheets ${RATE_SHEET_NAMES.join(", ")}; found ${sheets
        .map((s) => s.name)
        .join(", ")}`,
    );
  }

  const sheetIds = sheets.map((s) => s.id);
  const lines = await db
    .select({
      voiceRateSheetId: schema.voiceRateSheetLines.voiceRateSheetId,
      voiceNumberingPlanDestinationId:
        schema.voiceRateSheetLines.voiceNumberingPlanDestinationId,
      ratePerMinute: schema.voiceRateSheetLines.ratePerMinute,
    })
    .from(schema.voiceRateSheetLines)
    .where(
      and(
        inArray(schema.voiceRateSheetLines.voiceRateSheetId, sheetIds),
        isNull(schema.voiceRateSheetLines.deletedAt),
      ),
    );

  const ratesByPair = new Map<string, string>();
  for (const line of lines) {
    const key = `${line.voiceRateSheetId}|${line.voiceNumberingPlanDestinationId}`;
    ratesByPair.set(key, line.ratePerMinute);
  }

  const carriers = await db
    .select({
      id: schema.carriers.id,
      name: schema.carriers.name,
    })
    .from(schema.carriers)
    .where(isNull(schema.carriers.deletedAt));
  if (carriers.length === 0) throw new Error("no carriers to seed against");

  const countryRows = await db
    .select({
      iso2: schema.countries.iso2,
      nameEn: schema.countries.nameEn,
    })
    .from(schema.countries)
    .where(isNull(schema.countries.deletedAt));
  const countryNameByIso2 = new Map<string, string>(
    countryRows.map((c) => [c.iso2, c.nameEn]),
  );

  const rows: NewAtVoiceTerminationRow[] = [];
  let skipped = 0;

  for (let i = 0; i < TARGET_TOTAL; i += 1) {
    const type: AtVoiceTerminationType =
      i < ASSIGNED_COUNT ? "assigned" : "generated";
    const destination = pickRandom(destinations);
    const sheet = pickRandom(sheets);
    const key = `${sheet.id}|${destination.id}`;
    const sheetRate = ratesByPair.get(key);
    if (!sheetRate) {
      skipped += 1;
      continue;
    }

    const carrier = pickRandom(carriers);
    const carrierRate = Number.parseFloat(sheetRate) * CARRIER_RATE_FACTOR;
    const carrierRatePerMinute = carrierRate.toFixed(6);
    const payoutPerMinuteWeekly = (
      carrierRate * PAYOUT_WEEKLY_MULTIPLIER
    ).toFixed(6);
    const payoutPerMinuteLongTerm = (
      carrierRate * PAYOUT_LONG_TERM_MULTIPLIER
    ).toFixed(6);

    rows.push({
      carrierId: carrier.id,
      voiceNumberingPlanDestinationId: destination.id,
      status: "active",
      type,
      name: `${countryNameByIso2.get(destination.countryIso2) ?? destination.countryIso2} #${pad(i)}`,
      currency: sheet.currency,
      carrierCurrency: sheet.currency,
      carrierRatePerMinute,
      carrierBillingCycleDays: BILLING_CYCLE_DAYS,
      carrierPaymentTermsDays: PAYMENT_TERMS_DAYS,
      payoutPerMinuteWeekly,
      payoutPerMinuteLongTerm,
      payoutBillingCycleDays: BILLING_CYCLE_DAYS,
      payoutPaymentTermsDays: PAYMENT_TERMS_DAYS,
      countryIso2: destination.countryIso2,
      maxCallDurationMinutes: 60,
      targetAcdMinutes: 5,
      targetAsrPercent: 50,
      maxANumberConcurrentCalls: 3,
      maxBNumberConcurrentCalls: 3,
      maxAToBNumberConcurrentCalls: 3,
      ...generateDailyCaps(),
    });
  }

  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const chunk = rows.slice(i, i + INSERT_CHUNK);
    await db.insert(schema.atVoiceTerminations).values(chunk);
  }

  const assigned = rows.filter((r) => r.type === "assigned").length;
  const generated = rows.filter((r) => r.type === "generated").length;
  console.log(
    `seeded at_voice_terminations: ${rows.length} rows (assigned=${assigned}, generated=${generated}, skipped=${skipped})`,
  );
}
