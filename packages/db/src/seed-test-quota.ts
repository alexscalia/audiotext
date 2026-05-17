import { and, eq, isNull } from "drizzle-orm";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import Redis from "ioredis";
import * as schema from "./schema.js";

// Deterministic fixture for end-to-end quota tests.
// Idempotent: safe to run repeatedly without truncation.
//
// Creates:
//   - test carrier
//   - test voice_trunk (auth_type=ip, status=active)
//   - test voice_trunk_ip = SIPP_IP env var (defaults to 172.28.99.50,
//     the static IP assigned to the `sipp` service in docker-compose.sip.yml)
//   - test prefix "99" (tech-prefix that sipp will prepend on B-number)
//   - voice_numbering_plan "TestPlan" + destination "TestDID"
//   - at_voice_range with max_daily_total_minutes=1 (60s cap → first call
//     reserves 60s, second call rejected with 503/34)
//   - test user (status=active)
//   - at_voice_number "18005551234" assigned to that user
//
// Fixed UUIDs let tests assert against well-known IDs without lookup.

const TEST_CARRIER_ID = "00000000-0000-0000-0000-000000000a01";
const TEST_TRUNK_ID = "00000000-0000-0000-0000-000000000a02";
const TEST_PLAN_ID = "00000000-0000-0000-0000-000000000a03";
const TEST_DEST_ID = "00000000-0000-0000-0000-000000000a04";
const TEST_RANGE_ID = "00000000-0000-0000-0000-000000000a05";
const TEST_USER_ID = "00000000-0000-0000-0000-000000000a06";
const TEST_NUMBER_ID = "00000000-0000-0000-0000-000000000a07";

const TEST_DID = "18005551234";
const TEST_PREFIX = "99";
const TEST_USER_EMAIL = "quota-test@audiotext.test";
const SIPP_IP = process.env.SIPP_IP ?? "172.28.99.50";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema });

  await db
    .insert(schema.carriers)
    .values({
      id: TEST_CARRIER_ID,
      name: "Test Carrier (quota)",
      businessName: "Test Carrier LLC",
      status: "active",
      billingDetails: { vatNumber: "TEST", address: "n/a" } as never,
      ratesName: "Test",
      ratesEmail: "rates@test",
      billingName: "Test",
      billingEmail: "billing@test",
      nocName: "Test",
      nocEmail: "noc@test",
      salesName: "Test",
      salesEmail: "sales@test",
      timezone: "UTC",
    })
    .onConflictDoNothing({ target: schema.carriers.id });

  await db
    .insert(schema.voiceTrunks)
    .values({
      id: TEST_TRUNK_ID,
      carrierId: TEST_CARRIER_ID,
      name: "test-trunk",
      status: "active",
      direction: "both",
      protocol: "sip",
      transport: "udp",
      authType: "ip",
      codecs: ["PCMU"],
    })
    .onConflictDoNothing({ target: schema.voiceTrunks.id });

  // Trunk IP — sipp's source IP must match this row at /authorize time.
  const existingIp = await db
    .select({ id: schema.voiceTrunkIps.id })
    .from(schema.voiceTrunkIps)
    .where(
      and(
        eq(schema.voiceTrunkIps.voiceTrunkId, TEST_TRUNK_ID),
        eq(schema.voiceTrunkIps.ip, SIPP_IP),
        eq(schema.voiceTrunkIps.prefix, TEST_PREFIX),
        isNull(schema.voiceTrunkIps.deletedAt),
      ),
    )
    .limit(1);
  if (!existingIp[0]) {
    await db.insert(schema.voiceTrunkIps).values({
      voiceTrunkId: TEST_TRUNK_ID,
      ip: SIPP_IP,
      prefix: TEST_PREFIX,
      status: "active",
    });
  }

  await db
    .insert(schema.voiceNumberingPlans)
    .values({
      id: TEST_PLAN_ID,
      name: "TestPlan",
      status: "active",
    })
    .onConflictDoNothing({ target: schema.voiceNumberingPlans.id });

  await db
    .insert(schema.voiceNumberingPlanDestinations)
    .values({
      id: TEST_DEST_ID,
      voiceNumberingPlanId: TEST_PLAN_ID,
      countryIso2: "US",
      name: "TestDID",
      minDigits: 8,
      maxDigits: 15,
    })
    .onConflictDoNothing({ target: schema.voiceNumberingPlanDestinations.id });

  // Range with low cap: max_daily_total_minutes=1 → 60s.
  // First call reserves 60s. Subsequent INVITE rejected with 503/34.
  await db
    .insert(schema.atVoiceRanges)
    .values({
      id: TEST_RANGE_ID,
      status: "active",
      type: "assigned",
      carrierId: TEST_CARRIER_ID,
      voiceNumberingPlanDestinationId: TEST_DEST_ID,
      name: "test-range-low-cap",
      currency: "usd",
      carrierCurrency: "usd",
      carrierRatePerMinute: "0.010000",
      carrierBillingCycleDays: 30,
      carrierPaymentTermsDays: 14,
      payoutPerMinuteWeekly: "0.015000",
      payoutPerMinuteLongTerm: "0.012000",
      payoutBillingCycleDays: 30,
      payoutPaymentTermsDays: 14,
      countryIso2: "US",
      maxDailyTotalMinutes: 1,
    })
    .onConflictDoNothing({ target: schema.atVoiceRanges.id });

  await db
    .insert(schema.users)
    .values({
      id: TEST_USER_ID,
      name: "Quota Test User",
      email: TEST_USER_EMAIL,
      emailVerified: true,
      status: "active",
    })
    .onConflictDoNothing({ target: schema.users.id });

  await db
    .insert(schema.atVoiceNumbers)
    .values({
      id: TEST_NUMBER_ID,
      atVoiceRangeId: TEST_RANGE_ID,
      userId: TEST_USER_ID,
      number: TEST_DID,
    })
    .onConflictDoNothing({ target: schema.atVoiceNumbers.id });

  console.log("test fixtures ready:");
  console.log(`  carrier_id  = ${TEST_CARRIER_ID}`);
  console.log(`  trunk_id    = ${TEST_TRUNK_ID}`);
  console.log(`  range_id    = ${TEST_RANGE_ID}`);
  console.log(`  user_id     = ${TEST_USER_ID}`);
  console.log(`  DID         = ${TEST_DID}`);
  console.log(`  prefix      = ${TEST_PREFIX}`);
  console.log(`  sipp_ip     = ${SIPP_IP}`);
  console.log(`  cap         = max_daily_total_minutes=1 (60s)`);

  // Tell sip-signaling to reload its in-memory cache so the new range,
  // DID, trunk and IP are visible to the next /authorize call.
  const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
  try {
    const pub = new Redis(redisUrl, { lazyConnect: false });
    await pub.publish("lcr:reload", "x");
    await pub.quit();
    console.log(`  lcr:reload  = published`);
  } catch (err) {
    console.warn(`  lcr:reload  = FAILED (${(err as Error).message})`);
    console.warn(`  manual:    redis-cli -h localhost -p 6379 PUBLISH lcr:reload x`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
