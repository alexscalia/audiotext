import { and, inArray, isNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";
import type { NewAtVoiceNumberRow } from "./schema.js";

const MIN_PER_RANGE = 10;
const MAX_PER_RANGE = 100;
const INSERT_CHUNK = 500;

function randomInt(minInclusive: number, maxInclusive: number): number {
  return (
    Math.floor(Math.random() * (maxInclusive - minInclusive + 1)) + minInclusive
  );
}

function pickRandom<T>(arr: readonly T[]): T {
  const idx = Math.floor(Math.random() * arr.length);
  return arr[idx]!;
}

function randomDigits(n: number): string {
  let out = "";
  for (let i = 0; i < n; i += 1) {
    out += Math.floor(Math.random() * 10).toString();
  }
  return out;
}

export async function seedAtVoiceNumbers(
  db: NodePgDatabase<typeof schema>,
): Promise<void> {
  const existing = await db
    .select({ id: schema.atVoiceNumbers.id })
    .from(schema.atVoiceNumbers)
    .where(isNull(schema.atVoiceNumbers.deletedAt))
    .limit(1);
  if (existing[0]) {
    console.log("at_voice_numbers already seeded — skipping");
    return;
  }

  const ranges = await db
    .select({
      id: schema.atVoiceRanges.id,
      voiceNumberingPlanDestinationId:
        schema.atVoiceRanges.voiceNumberingPlanDestinationId,
    })
    .from(schema.atVoiceRanges)
    .where(isNull(schema.atVoiceRanges.deletedAt));
  if (ranges.length === 0) {
    console.log("no at_voice_ranges found — skipping at_voice_numbers");
    return;
  }

  const destinationIds = Array.from(
    new Set(ranges.map((t) => t.voiceNumberingPlanDestinationId)),
  );

  const destinationRows = await db
    .select({
      id: schema.voiceNumberingPlanDestinations.id,
      minDigits: schema.voiceNumberingPlanDestinations.minDigits,
      maxDigits: schema.voiceNumberingPlanDestinations.maxDigits,
    })
    .from(schema.voiceNumberingPlanDestinations)
    .where(
      and(
        inArray(schema.voiceNumberingPlanDestinations.id, destinationIds),
        isNull(schema.voiceNumberingPlanDestinations.deletedAt),
      ),
    );
  const destinationMap = new Map<
    string,
    { minDigits: number; maxDigits: number }
  >(
    destinationRows.map((d) => [
      d.id,
      { minDigits: d.minDigits, maxDigits: d.maxDigits },
    ]),
  );

  const codeRows = await db
    .select({
      voiceNumberingPlanDestinationId:
        schema.voiceNumberingPlanCodes.voiceNumberingPlanDestinationId,
      fullCode: schema.voiceNumberingPlanCodes.fullCode,
    })
    .from(schema.voiceNumberingPlanCodes)
    .where(
      and(
        inArray(
          schema.voiceNumberingPlanCodes.voiceNumberingPlanDestinationId,
          destinationIds,
        ),
        isNull(schema.voiceNumberingPlanCodes.deletedAt),
      ),
    );
  const codesByDestination = new Map<string, string[]>();
  for (const row of codeRows) {
    const list = codesByDestination.get(row.voiceNumberingPlanDestinationId);
    if (list) list.push(row.fullCode);
    else codesByDestination.set(row.voiceNumberingPlanDestinationId, [row.fullCode]);
  }

  const generated = new Set<string>();
  const rows: NewAtVoiceNumberRow[] = [];
  let skippedRanges = 0;
  let skippedSlots = 0;

  for (const range of ranges) {
    const destination = destinationMap.get(
      range.voiceNumberingPlanDestinationId,
    );
    const codes = codesByDestination.get(
      range.voiceNumberingPlanDestinationId,
    );
    if (!destination || !codes || codes.length === 0) {
      skippedRanges += 1;
      continue;
    }

    const count = randomInt(MIN_PER_RANGE, MAX_PER_RANGE);
    const maxAttempts = count * 20;

    for (let slot = 0; slot < count; slot += 1) {
      let attempts = 0;
      let placed = false;
      while (attempts < maxAttempts) {
        attempts += 1;
        const prefix = pickRandom(codes);
        const targetLen = randomInt(destination.minDigits, destination.maxDigits);
        const remaining = targetLen - prefix.length;
        if (remaining < 0) continue;
        const candidate = prefix + randomDigits(remaining);
        if (generated.has(candidate)) continue;
        generated.add(candidate);
        rows.push({
          atVoiceRangeId: range.id,
          number: candidate,
        });
        placed = true;
        break;
      }
      if (!placed) skippedSlots += 1;
    }
  }

  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const chunk = rows.slice(i, i + INSERT_CHUNK);
    await db.insert(schema.atVoiceNumbers).values(chunk);
  }

  console.log(
    `seeded at_voice_numbers: ${rows.length} numbers across ${ranges.length - skippedRanges} ranges (skippedRanges=${skippedRanges}, skippedSlots=${skippedSlots})`,
  );
}
