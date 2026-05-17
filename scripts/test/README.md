# Testing — audiotext SIP quota enforcement

End-to-end + stress harness for the per-range daily-minute quota path
(`max_daily_total_minutes` and siblings on `at_voice_ranges`).

This document covers:

1. [What the tests exercise](#1-what-the-tests-exercise)
2. [Architecture of a test run](#2-architecture-of-a-test-run)
3. [Repository layout](#3-repository-layout)
4. [Prerequisites](#4-prerequisites)
5. [Functional smoke test](#5-functional-smoke-test)
6. [Stress: full ladder under quota](#6-stress-full-ladder-under-quota)
7. [Stress: authorize hot path only](#7-stress-authorize-hot-path-only)
8. [Expected outputs and what to watch](#8-expected-outputs-and-what-to-watch)
9. [Troubleshooting](#9-troubleshooting)
10. [Adding a new scenario](#10-adding-a-new-scenario)
11. [Caveats](#11-caveats)

---

## 1. What the tests exercise

End-to-end, one call hits every component of the quota path:

| Component | Behavior verified |
|---|---|
| `kamailio-edge` | Receives INVITE, calls Zig `/authorize`, parses JSON, rewrites `$rU` with stripped B, appends `X-Range-Id`/`X-Trunk-Id`/`X-A`/`X-B`/`X-B-Dialed` headers, relays to FreeSWITCH. |
| `sip-signaling` (Zig) | Cache lookup (`ip+prefix → trunk + range_id`), block-list scan, owned-DID check, atomic Redis `EVALSHA quota_reserve` reservation of 60s. |
| Redis | Holds `quota:range:<id>:total:<UTC-date>` (and per-A/per-B/per-A-to-B) with 48h TTL. Lua script enforces all-or-nothing reserve. |
| `freeswitch` | Reads `X-*` headers into channel variables (`at_voice_range_id`, `voice_trunk_id`, `a_number`, `b_number`, `b_number_dialed`), answers IVR, plays `welcome.wav`. |
| `apps/api` CDR listener | ESL subscribes to `CHANNEL_DESTROY`, inserts `voice_cdrs` row with attribution + billsec, `INCRBY (billsec - 60)` on four Redis keys (refunds reservation if no-answer). |
| `voice_cdrs` table | Receives one row per call with `at_voice_range_id`, `voice_trunk_id`, `a_number`, `b_number`, `b_number_dialed`, `duration_seconds`. |

The cap-rejection path additionally verifies:

- Zig returns `503 / Q.850 cause=34` when the Redis counter would exceed cap.
- Kamailio passes the cause back to the carrier via `Reason:` header.
- No `voice_cdrs` row written for rejected INVITEs (call never reaches FS).

---

## 2. Architecture of a test run

```
+------------+      INVITE     +---------------+    GET /authorize     +---------------+
|   sipp     | --------------> | kamailio-edge | --------------------> | sip-signaling |
| (172.28    |   UDP 5060      |  request_route|     HTTP 8080         |   (Zig)       |
|  .99.50)   |                 +-------+-------+                       +-------+-------+
+-----+------+                         |                                        |
      |                                | jansson_get(b, range_id, trunk_id)     |
      |                                | rewrite $rU = stripped_b               |
      |                                | append_hf X-Range-Id ... X-B-Dialed    |
      |                                v                                        v
      |                         +-------+-------+                       +-------+-------+
      |                         |  freeswitch   | <- INVITE w/ headers  |     Redis     |
      |                         |   public ctx  |                       |  EVALSHA      |
      |                         | set chan vars |                       |  quota_reserve|
      |                         |  answer + IVR |                       +-------+-------+
      |                         +-------+-------+                               ^
      | 200 OK + ACK + 5s + BYE         |                                       |
      <---------------------------------+                                       |
                                        | CHANNEL_DESTROY (ESL 8021)            |
                                        v                                       |
                                +-------+-------+         INCRBY billsec-60     |
                                |  apps/api     | ------------------------------+
                                | CDR listener  |
                                +-------+-------+
                                        |
                                        v INSERT voice_cdrs
                                +-------+-------+
                                |   postgres    |
                                +---------------+
```

---

## 3. Repository layout

```
scripts/test/
  sipp/
    inbound-call.xml          # full INVITE ladder, 5s media, BYE
    inbound-invite-only.xml   # auth/quota probe, no media (accepts 200/403/503)
    calls.csv                 # randomized A/B fixture for stress runs
  e2e/
    functional.sh             # smoke test w/ DB + Redis assertions
    stress-quota.sh           # sustained CPS through the full ladder
    stress-authorize.sh       # wrk against Zig /authorize only
  README.md                   # this file
packages/db/src/seed-test-quota.ts  # deterministic fixture
docker-compose.sip.yml        # +sipp service (profile=test, static IP)
```

Fixed UUIDs in the seed (so assertions can hard-code IDs):

| Entity | UUID |
|---|---|
| carrier | `00000000-0000-0000-0000-000000000a01` |
| voice_trunk | `00000000-0000-0000-0000-000000000a02` |
| voice_numbering_plan | `00000000-0000-0000-0000-000000000a03` |
| voice_numbering_plan_destination | `00000000-0000-0000-0000-000000000a04` |
| at_voice_range | `00000000-0000-0000-0000-000000000a05` |
| user | `00000000-0000-0000-0000-000000000a06` |
| at_voice_number | `00000000-0000-0000-0000-000000000a07` |

Other fixed values: prefix `99`, DID `18005551234`, sipp IP `172.28.99.50`, cap `60s` (`max_daily_total_minutes=1`).

---

## 4. Prerequisites

| Tool | Purpose | Install |
|---|---|---|
| `docker` + `docker compose` | run stack | Docker Desktop / engine |
| `redis-cli` | assert counters | `brew install redis` |
| `psql` | assert CDR rows | `brew install libpq && brew link --force libpq` |
| `pnpm` | seed script | already installed (workspace) |
| `wrk` | stress-authorize.sh only | `brew install wrk` |

One-time bring-up:

```bash
docker compose -f docker-compose.yml -f docker-compose.sip.yml up -d --build
pnpm install
pnpm db:migrate                    # ensures voice_cdrs columns exist
```

The `sipp` service is gated behind compose profile `test` — it does NOT
start with the default bring-up. Each scenario invokes it via
`docker compose --profile test run --rm sipp ...`.

---

## 5. Functional smoke test

```bash
bash scripts/test/e2e/functional.sh
```

Step-by-step:

1. Brings up `postgres`, `redis`, `sip-signaling`, `kamailio-edge`, `freeswitch`.
2. Waits for postgres + redis to be reachable from host.
3. Runs `pnpm db:seed-test-quota` — idempotent insert of fixture rows
   (cap `max_daily_total_minutes=1` → 60s).
4. Publishes `lcr:reload` so the Zig cache picks up the new range + DID.
5. Clears stale `quota:range:<id>:*` keys to start clean.
6. Sends one full call via sipp using `inbound-call.xml`.
7. Asserts:
   - `voice_cdrs` row count for the test range >= 1
   - `quota:range:<range_id>:total:<UTC-date>` exists and > 0
8. Forces Redis counter to cap (60), sends a probe INVITE with
   `inbound-invite-only.xml`. sipp accepts `503 + Reason: Q.850;cause=34`.

Idempotent. Safe to re-run. Pass-criteria: script exits `0` and prints `PASS`.

---

## 6. Stress: full ladder under quota

```bash
CPS=20 MAX_CONC=100 TOTAL=2000 bash scripts/test/e2e/stress-quota.sh
```

Knobs:

| var | default | meaning |
|---|---|---|
| `CPS` | 10 | calls per second |
| `MAX_CONC` | 50 | max concurrent in-flight calls |
| `TOTAL` | 500 | total calls to place |
| `DID` | 18005551234 | destination DID |

Watch during the run:

```bash
# signaling decisions
docker compose -f docker-compose.yml -f docker-compose.sip.yml \
  logs --tail=200 sip-signaling | grep -E 'authorize|quota'

# FreeSWITCH concurrent channels
docker exec audiotext-freeswitch fs_cli -x 'show channels count'

# Redis ops/sec
docker exec audiotext-redis redis-cli INFO stats | grep instantaneous_ops_per_sec
```

Pass criteria:

- Once the counter saturates the cap, NO subsequent `result=active` lines
  appear for that range in sip-signaling logs — only `result=quota_total`.
  Verifies Lua atomicity (no over-reservation under contention).
- sipp final summary shows `Failed call:` matches the expected reject count.

---

## 7. Stress: authorize hot path only

```bash
DURATION=30s THREADS=4 CONNECTIONS=50 bash scripts/test/e2e/stress-authorize.sh
```

Bypasses Kamailio + FreeSWITCH. `wrk` hits Zig `/authorize` directly.
Each request reserves 60s in Redis against the test range, so counters
saturate quickly — clear them before/after to avoid polluting other runs:

```bash
redis-cli --scan --pattern 'quota:range:00000000-0000-0000-0000-000000000a05:*' \
  | xargs redis-cli DEL
```

Use this lane to measure the cost of the Lua `EVALSHA` and tune
signaling thread count, separate from the SIP/RTP path.

---

## 8. Expected outputs and what to watch

### `sip-signaling` log lines

```
authorize ip=172.28.99.50 a=+15555550001 b=99+18005551234 result=active stripped_b=18005551234
authorize ip=172.28.99.50 a=+15555550001 b=99+18005551234 result=quota_total range_id=00000000-...-a05
```

### Redis keys after one call

```
$ redis-cli KEYS 'quota:range:00000000-0000-0000-0000-000000000a05:*'
1) "quota:range:00000000-0000-0000-0000-000000000a05:total:2026-05-17"
2) "quota:range:00000000-0000-0000-0000-000000000a05:a:+15555550001:2026-05-17"
3) "quota:range:00000000-0000-0000-0000-000000000a05:b:18005551234:2026-05-17"
4) "quota:range:00000000-0000-0000-0000-000000000a05:ab:+15555550001:18005551234:2026-05-17"

$ redis-cli GET 'quota:range:.../total:2026-05-17'
"5"   # ~billsec for a 5s media call; if listener hasn't settled yet you'll see "60" (reservation only)

$ redis-cli TTL 'quota:range:.../total:2026-05-17'
(integer) 172800
```

### `voice_cdrs` row

```sql
SELECT at_voice_range_id, voice_trunk_id, a_number, b_number, b_number_dialed,
       duration_seconds, started_at
FROM voice_cdrs
WHERE at_voice_range_id = '00000000-0000-0000-0000-000000000a05'
ORDER BY started_at DESC LIMIT 1;
```

Expect attribution fields populated, `duration_seconds ≈ 5`.

### sipp summary (full ladder)

```
Successful call: 1
Failed call: 0
```

### sipp summary (probe at cap)

The probe scenario branches to `done` on 503, exiting 0. Look in stderr
trace for the received status line if you need to confirm cause code.

---

## 9. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| sipp gets `403 cause=21` | Trunk-IP row missing or IP mismatch | Re-run `pnpm db:seed-test-quota`; confirm sipp container IP via `docker inspect audiotext-sipp` matches `voice_trunk_ips.ip` |
| sipp gets `503 cause=34` before any cap hit | DID not in `at_voice_numbers` for active user; OR cache stale | `redis-cli PUBLISH lcr:reload x`; check sip-signaling log line `loaded N trunk_ip rows, M active DIDs, K ranges` |
| `voice_cdrs` row missing after call | CDR listener disabled (`CDR_LISTENER_ENABLED=false`) or apps/api not running | Start `pnpm dev` or set `CDR_LISTENER_ENABLED=true` and restart api |
| ESL listener can't connect | FreeSWITCH `event_socket.conf.xml` not listening on `:8021`, or wrong password | Default is `ClueCon`; override with `FREESWITCH_ESL_PASSWORD` env |
| Redis counter never increments | EVALSHA NOSCRIPT race after Redis flush; or fail-open path | Restart sip-signaling so `SCRIPT LOAD` re-runs |
| sipp container can't resolve `kamailio-edge` | Network IPAM mismatch | `docker compose down`; `up -d` recreates `sip` network with `172.28.99.0/24` |
| `network audiotext_sip needs to be recreated` | Subnet changed in compose file | `docker compose down` then `up -d` |

---

## 10. Adding a new scenario

To add a new sipp scenario:

1. Drop the `.xml` under `scripts/test/sipp/`.
2. Reference it from a new wrapper in `scripts/test/e2e/` so callers don't
   have to know the docker compose incantation.
3. If new fixture data is needed, extend `seed-test-quota.ts` (keep it
   idempotent; pick a fresh fixed UUID following the `...aNN` pattern).

To add a new assertion:

1. Add a `psql -At -c '...'` or `redis-cli GET ...` line to
   `functional.sh`, compare to expected, exit non-zero on mismatch.
2. Re-run; the script is fast (<10s after stack is warm).

---

## 11. Caveats

- **macOS Docker Desktop**: UDP perf caps real CPS around 200; run real
  stress on a Linux box or dev cluster.
- **`sipp` image** (`ctaloi/sipp:latest`): community-maintained. Pin a
  digest in CI: `image: ctaloi/sipp@sha256:<digest>`.
- **`voice_cdrs` accumulation**: stress runs leave thousands of rows.
  Clean between sessions:
  ```sql
  DELETE FROM voice_cdrs WHERE at_voice_range_id = '00000000-0000-0000-0000-000000000a05';
  ```
- **Test DB is shared with dev DB**: the seed script writes into the same
  Postgres instance as `pnpm db:seed`. The fixed test UUIDs are
  partitioned (`...aNN` range) so they never collide with random
  production seeds — but DELETE the fixture before promoting the DB.
- **Wall-clock dependency**: quota keys are scoped to UTC date. A test
  spanning midnight UTC will allocate against two keys; rare in practice
  but worth knowing if a long stress run straddles the boundary.
- **No outbound media in sipp**: scenarios send RTP-described SDP but
  sipp doesn't actually stream PCMU. FreeSWITCH plays its prompt anyway
  because the call is one-way (IVR → caller). For two-way media testing
  you'd need `sipp -mi <ip> -mp <port>` plus `pcap_play`.
