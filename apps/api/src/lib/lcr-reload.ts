import Redis from "ioredis";

// Pub/sub channel the sip-signaling (Zig) cache subscribes to. Receiving any
// message on this channel triggers a full reload of credentials, DIDs,
// ranges, block-lists and quotas from Postgres. Reload latency is ~50–200ms.
//
// Call publishLcrReload() AFTER any successful mutation to a table that
// sip-signaling caches:
//   - at_voice_numbers              (DID add/delete/reassign)
//   - at_voice_ranges               (status, quota cols, delete)
//   - voice_trunks                  (status, delete)
//   - voice_trunk_ips               (add/delete/disable, prefix change)
//   - voice_trunk_blocked_prefixes  (add/delete/expire)
//   - at_voice_range_blocked_prefixes (add/delete/expire)
//   - users                         (status flip — cascades to that user's DIDs)
//
// Don't call from read paths or admin-only metadata changes (e.g. carrier
// rename, contact info edits) — those don't affect the signaling decision.
//
// The publish is best-effort: failures log but don't abort the mutation.
// If Redis is down, sip-signaling keeps serving stale data until the next
// successful reload — degraded but available.

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const CHANNEL = "lcr:reload";

let pub: Redis | null = null;

function client(): Redis {
  if (!pub) {
    pub = new Redis(REDIS_URL, { lazyConnect: false });
    pub.on("error", (err) => {
      console.error("[lcr-reload] redis error:", err.message);
    });
  }
  return pub;
}

export async function publishLcrReload(): Promise<void> {
  try {
    await client().publish(CHANNEL, "x");
  } catch (err) {
    console.error("[lcr-reload] publish failed:", err);
  }
}

export async function closeLcrReload(): Promise<void> {
  if (pub) {
    await pub.quit().catch(() => {});
    pub = null;
  }
}
