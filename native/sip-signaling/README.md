# sip-signaling — Zig LCR / authorization engine

Latency-critical service queried by Kamailio on every incoming SIP `INVITE`. Holds carrier/trunk routing state in memory; reloads on Redis pub/sub.

Lives at `native/sip-signaling/`. Built with Zig 0.14, links `libpq` (Postgres) and `libhiredis` (Redis). Runs as a Docker container on the `sip` network.

---

## Authentication model

**Credential = `(ip, prefix)`** — conceptually `user + password`. The carrier authenticates to us by:

1. Sending the INVITE from a registered source IP, AND
2. Prepending the agreed tech prefix to the B-number.

Both factors must match a row in `voice_trunk_ips`. If either fails, auth fails. On success, Zig strips the matched prefix from the B-number and kamailio rewrites `$rU` so downstream (dispatcher / FreeSWITCH) sees the clean E.164 destination.

Multiple `(ip, prefix)` rows per IP are explicitly supported — the schema's partial unique index is on `(voice_trunk_id, ip, prefix)`. A single IP can authenticate under different credentials by signalling which one via the tech prefix.

### Outcomes

For an incoming INVITE with source IP `X` and B-number `B`:

| Outcome | When | SIP | Q.850 | Upstream behavior |
|---|---|---|---|---|
| **accept** | at least one active credential for `X` whose `prefix` is a prefix of `B` (longest wins; NULL/empty prefix = catch-all fallback) | relay with `$rU` rewritten to `B` minus prefix | — | normal |
| **unknown** | no rows for `X`, OR rows exist but none match `B` | `403 Forbidden` | `21` (call rejected) | stops retrying — permanent rejection |
| **inactive** | a matching row exists but the credential is disabled (`ip.status='inactive'` OR parent trunk inactive) | `503 Service Unavailable` | `34` (no circuit/channel) | typically retries on alternate carrier per RFC 3326 |

Prefix mismatch deliberately collapses into `unknown`: from the caller's perspective, failed auth is failed auth, and we want the same upstream behavior (stop retrying us).

### Matching rules

- **Longest specific prefix wins.** Rows `prefix='1'` and `prefix='12'` on the same IP — `B='12345'` picks `'12'`, stripping to `'345'`. `B='1abc'` picks `'1'`, stripping to `'abc'`.
- **NULL/empty prefix is a catch-all fallback.** Matches any `B` but only when no specific prefix matches. Strips nothing (zero-length strip). Models "this IP authenticates without any tech prefix".
- **Active shadows inactive.** If a specific active prefix matches AND a (less specific) inactive prefix would also match, the active one wins and the call is allowed. Inactive only surfaces when no active credential matches.
- **Trunk status feeds the credential's `active` flag.** `vt.status IN ('active', 'testing')` → eligible; `inactive` → not eligible. Soft-deleted trunks or trunk-ip rows drop out of the cache entirely (treated as `unknown`).

`testing` is treated as `active` so ops can validate a new carrier credential end-to-end before promoting it.

Nothing else is decided yet. No carrier selection, no rate-sheet lookup, no numbering-plan match against the stripped B — those are future steps.

---

## Architecture

```
                   ┌─────────────────────────────────────┐
INVITE  ──udp/5060─►  kamailio-edge                      │
                   │  request_route { ... }              │
                   └──────┬──────────────────────────────┘
                          │ http_client_query
                          │ GET /authorize?ip=$si&a=$fU&b=$rU
                          ▼
                   ┌─────────────────────────────────────┐
                   │  sip-signaling (Zig)                │
                   │  ────────────────────────────────── │
                   │  StringHashMap<ip, []Credential>    │  ◄── mutex-guarded
                   │  Credential { prefix, active }      │
                   │  ────────────────────────────────── │
                   │  HTTP/1.1 :8080                     │
                   └──────┬──────────────────────────────┘
                          │ at boot + on SUBSCRIBE lcr:reload
                          ▼
                   ┌────────────────────┐   ┌──────────────────┐
                   │  Postgres          │   │  Redis           │
                   │  voice_trunks      │   │  pub/sub:        │
                   │  voice_trunk_ips   │   │   lcr:reload     │
                   └────────────────────┘   └──────────────────┘
```

**Hot path** (Kamailio → Zig → reply):

1. Kamailio extracts source IP into `$si`, A-number from `$fU`, B-number from `$rU`. A/B are URL-escaped via `{s.escape.param}`.
2. `http_client_query("http://sip-signaling:8080/authorize?ip=$si&a=...&b=...", "$var(auth_body)")`.
3. Zig URL-decodes each param, takes the cache mutex briefly, runs longest-prefix-match against the credential list for that IP. Returns one of:
   - `{"allowed":1,"b":"<stripped-B-number>"}` (accept)
   - `{"allowed":0,"status":403,"cause":21}` (unknown peer or wrong prefix)
   - `{"allowed":0,"status":503,"cause":34}` (matching credential is inactive)
4. Kamailio runs `jansson_get` on `allowed`, `status`, `cause`. If `allowed != 1` → `append_to_reply("Reason: Q.850;cause=$var(cause)\r\n")` + `sl_send_reply` with the SIP status code (`403` or `503`).
5. On accept, kamailio runs `jansson_get("b", ...)` and assigns the stripped value to `$rU` (`$rU = $var(stripped_b)`). Then → `record_route` + dispatcher pick + `t_relay`. FreeSWITCH and any downstream see the clean E.164 destination, no tech prefix.

No Postgres roundtrip on the hot path. Lookup is one HashMap.get + a tiny linear scan of the per-IP credential list (typically 1–2 entries). SIP status + Q.850 cause are both chosen by Zig so future rejection paths can pick richer codes without touching `kamailio.cfg`.

---

## Data load (boot + reload)

Run once at startup, and again on every Redis `lcr:reload` message:

```sql
SELECT vti.ip,
       COALESCE(vti.prefix, '')                  AS prefix,
       (vti.status = 'active'
        AND vt.status IN ('active', 'testing'))  AS active
FROM voice_trunk_ips vti
JOIN voice_trunks    vt ON vt.id = vti.voice_trunk_id
WHERE vti.deleted_at IS NULL
  AND vt.deleted_at  IS NULL;
```

Every non-deleted `(ip, prefix, trunk)` triple is loaded. `COALESCE` collapses NULL prefix to empty string so Zig only has to handle one representation (`prefix.len == 0` = catch-all). The `active` boolean folds both the ip-row status and the parent-trunk status into a single eligibility flag.

The result populates a fresh `StringHashMap(std.ArrayList(Credential))` keyed by IP. Each list holds every credential registered for that IP. On reload the whole map is built fresh and atomically swapped under a `std.Thread.Mutex`; the previous map's keys, prefix strings, and list backing arrays are freed after the swap.

The SQL columns and table names come straight from `packages/db/src/schema.ts` (`voiceTrunks` + `voiceTrunkIps`). The relevant indexes that make this query fast already exist:

- `voice_trunks_status_idx`, `voice_trunks_deleted_at_idx`
- `voice_trunk_ips_status_idx`, `voice_trunk_ips_deleted_at_idx`, `voice_trunk_ips_trunk_idx`

---

## HTTP API

| Route | Method | Response |
|---|---|---|
| `/authorize?ip=<IPv4>&a=<from-user>&b=<r-uri-user>` | GET | one of: `200 {"allowed":1,"b":"<stripped-b>"}` / `200 {"allowed":0,"status":403,"cause":21}` / `200 {"allowed":0,"status":503,"cause":34}` |
| `/authorize` (no `ip`) | GET | `400 {"error":"missing ip"}` |
| `/healthz` | GET | `200 ok` |
| anything else | GET | `404 {"error":"not found"}` |

**Why GET (not POST):** decision is read-only + idempotent (same `(ip,a,b)` → same answer), cacheable, debuggable from curl. A-number / B-number are not secrets — they already travel in the SIP message in plaintext. Switch to POST only if the param set grows past ~5–6 values or we need to ship arrays.

**Query parameters:**

- `ip` (required) — taken from Kamailio's `$si`, exact source IP of the UDP datagram. IPv4 only for now. Drives the authorization decision.
- `a` (optional) — A-number / calling party. Kamailio sends `$fU` (`From:` user part). Logged today; will feed CDRs and per-carrier billing later. Carriers can spoof `From:` — for trust we'll switch to `$(hdr(P-Asserted-Identity){nameaddr.uri})` once we have trusted-peer config.
- `b` (recommended) — B-number / called party. Kamailio sends `$rU` (Request-URI user). **Used as the second auth factor** — the tech prefix is matched against this. On accept, Zig returns it stripped via the `b` field of the JSON response. If omitted (empty), only catch-all (NULL-prefix) credentials can authenticate.

All values are URL-decoded server-side per RFC 3986 (`%XX` only — `+` is preserved literally, since SIP user parts may contain `+E.164` prefixes).

**Why integer (`1`/`0`) and not `true`/`false`:** Kamailio's `$var()` variables are typed at first assignment. `jansson_get` of a JSON bool ends up int-typed; comparing `$var(allowed) != "true"` then triggers an auto string-to-int coerce on the literal `"true"`, which fails and the whole `if` expression evaluates false (silently lets traffic through). Returning an int keeps both sides of the comparison int.

**Why `cause` is sourced from Zig (not hardcoded in `kamailio.cfg`):** the rejection reason is a *policy* decision (which Q.850 code best signals what went wrong). Zig owns the policy; kamailio just transports it. This keeps the wire format stable as more rejection paths land — kamailio doesn't need editing every time a new cause appears. Today only `34` (no circuit/channel) is emitted; Step 2 will fan out into the rest of the Q.850 set (21 = call rejected, 38 = network out of order, 41 = temporary failure, etc.).

When `allowed == 1` the response does **not** include `cause` — there is no rejection to describe. Kamailio reads `cause` only after seeing `allowed != 1`.

---

## SIP + Q.850 mapping

| Trigger | Who picks values | SIP status | Reason header |
|---|---|---|---|
| signaling service unreachable (timeout / connection refused) | Kamailio (hardcoded fallback) | `503 Service Unavailable` | `Reason: Q.850;cause=41` |
| Zig returns `unknown` (no row for source IP, **or** rows exist but no prefix matches the B-number) | Zig response (`status`, `cause`) | `403 Forbidden` | `Reason: Q.850;cause=21` |
| Zig returns `inactive` (matching credential disabled — ip or trunk inactive) | Zig response (`status`, `cause`) | `503 Service Unavailable` | `Reason: Q.850;cause=34` |

Today the three values above are the only ones emitted. As more rejection paths land (rate-sheet missing, capacity hit, numbering-plan miss), the same wire path will carry richer codes without any `kamailio.cfg` churn — Zig flips the policy, kamailio just forwards. Likely additions: `38` (network out of order) for missing rate sheet, `41` (temporary failure) for transient backend failure, `34` for per-trunk capacity hit.

The `Reason` header is set with `append_to_reply()` from `textops.so` (must precede `sl_send_reply` — appended once it is added to the next stateless reply built by the sl module). `append_to_reply` evaluates `$var()` pseudo-variables in its argument, so the cause comes from `$var(cause)` populated by `jansson_get`. The SIP status code is selected with a small `if ($var(status) == 403)` branch — `sl_send_reply` takes literal code strings.

`http_client` is configured with `connection_timeout=1` (seconds). On any non-2xx or transport failure, `http_client_query` returns false → fallback `503 + cause 41` (temporary failure). The upstream carrier reads `Reason` per RFC 3326 and can route on it — typical SBC behavior is to retry on `34/38/41` and stop on `21`.

---

## Reload protocol

Anyone with write access to Redis can publish `lcr:reload` (payload is ignored):

```bash
docker exec audiotext-redis redis-cli PUBLISH lcr:reload x
```

The subscriber thread re-runs the SQL and swaps the map. Currently the publisher is not wired up in `apps/api` — that's the immediate next step. Once it is, the flow becomes:

```
admin UI POST /trunks/:id → drizzle UPDATE → publish lcr:reload → Zig reloads → next INVITE sees new state
```

Stale window is roughly `now() - reload publish time` — typically <50ms over a docker socket.

---

## Configuration

Environment variables (all required except `LISTEN_ADDR`):

| Var | Example | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql://audiotext:audiotext@postgres:5432/audiotext` | libpq URI; passed directly to `PQconnectdb` |
| `REDIS_URL` | `redis://redis:6379` | parsed for host+port; no auth, no TLS |
| `LISTEN_ADDR` | `0.0.0.0:8080` | defaults to `0.0.0.0:8080` |

Inside docker-compose these point at the in-network service names (`postgres`, `redis`). The host-side debug port mapping is `8088 → 8080`.

---

## File map

```
native/sip-signaling/
├── build.zig            # zig build script — links libpq + libhiredis
├── build.zig.zon        # package manifest (Zig 0.14 fingerprint required)
├── Dockerfile           # multi-stage: ziglang 0.14 builder → bookworm-slim runtime
├── .dockerignore
├── README.md            # this file
└── src/
    ├── main.zig         # env loading, cache init, thread spawn, http serve
    ├── cache.zig        # AuthCache: StringHashMap + Mutex + swap()
    ├── db.zig           # @cImport libpq-fe.h, run SELECT, fill cache
    ├── redis.zig        # @cImport hiredis.h, SUBSCRIBE lcr:reload, reload on msg
    └── http.zig         # raw HTTP/1.1 parse on std.net.Server, /authorize + /healthz
```

---

## Verification

### Bring the rig up

```bash
docker compose -f docker-compose.yml -f docker-compose.sip.yml up -d --build
docker logs -f audiotext-sip-signaling   # expect "loaded N authorized IPs from postgres"
```

### Direct HTTP probe (host)

```bash
# Pick an active IP+prefix pair from the seed data:
#   psql … -c "SELECT ip, prefix FROM voice_trunk_ips
#              JOIN voice_trunks vt ON vt.id = voice_trunk_id
#              WHERE vti.status='active' AND vt.status='active'
#                AND prefix IS NOT NULL LIMIT 1;"
# Then probe with B = <prefix><e164>:

curl 'http://localhost:8088/healthz'
# ok

curl 'http://localhost:8088/authorize?ip=103.94.165.51&b=42178391234567'
# {"allowed":1,"b":"391234567"}            ← prefix '42178' stripped

curl 'http://localhost:8088/authorize?ip=103.94.165.51&b=9999391234567'
# {"allowed":0,"status":403,"cause":21}    ← wrong prefix, fails auth

curl 'http://localhost:8088/authorize?ip=105.73.113.186&b=391234567'
# {"allowed":1,"b":"391234567"}            ← NULL-prefix catch-all, no strip

curl 'http://localhost:8088/authorize?ip=105.152.67.18&b=18391234567'
# {"allowed":0,"status":503,"cause":34}    ← prefix matches but trunk inactive

curl 'http://localhost:8088/authorize?ip=8.8.8.8&b=391234567'
# {"allowed":0,"status":403,"cause":21}    ← unknown IP
```

Longest-prefix-match check:

```bash
docker exec -i audiotext-postgres psql -U audiotext -d audiotext <<'SQL'
INSERT INTO voice_trunk_ips (voice_trunk_id, ip, status, prefix)
SELECT id, '172.20.0.60', 'active', '1'
FROM voice_trunks WHERE name='att-trunk-01' AND deleted_at IS NULL;
INSERT INTO voice_trunk_ips (voice_trunk_id, ip, status, prefix)
SELECT id, '172.20.0.60', 'active', '12'
FROM voice_trunks WHERE name='att-trunk-01' AND deleted_at IS NULL;
SQL
docker exec audiotext-redis redis-cli PUBLISH lcr:reload x

curl 'http://localhost:8088/authorize?ip=172.20.0.60&b=12345'
# {"allowed":1,"b":"345"}                  ← '12' wins over '1'
curl 'http://localhost:8088/authorize?ip=172.20.0.60&b=1abc'
# {"allowed":1,"b":"abc"}                  ← only '1' matches
curl 'http://localhost:8088/authorize?ip=172.20.0.60&b=99abc'
# {"allowed":0,"status":403,"cause":21}    ← neither matches → auth fails

docker exec -i audiotext-postgres psql -U audiotext -d audiotext \
    -c "DELETE FROM voice_trunk_ips WHERE ip='172.20.0.60';"
docker exec audiotext-redis redis-cli PUBLISH lcr:reload x
```

### SIP probe via sipp

Unknown source IP — expect `403 Forbidden` with `Reason: Q.850;cause=21`:

```bash
docker run --rm --network audiotext_sip ctaloi/sipp \
    -sn uac -m 1 -d 100 -timeout 5s -trace_msg kamailio-edge:5060
# tail the trace; the 403 must include the Reason header
```

Authenticated peer with tech prefix — expect kamailio log line `auth ok ... -> <stripped>` and a `200 OK`:

```bash
docker exec -i audiotext-postgres psql -U audiotext -d audiotext <<'SQL'
INSERT INTO voice_trunk_ips (voice_trunk_id, ip, status, prefix)
SELECT id, '172.20.0.70', 'active', '999'
FROM voice_trunks WHERE name='att-trunk-01' AND deleted_at IS NULL;
SQL
docker exec audiotext-redis redis-cli PUBLISH lcr:reload x

docker run --rm --network audiotext_sip --ip 172.20.0.70 ctaloi/sipp \
    -sn uac -m 1 -d 100 -timeout 5s \
    -s "999391234567" kamailio-edge:5060

docker logs --since 10s audiotext-kamailio-edge | grep "auth ok"
# [edge] auth ok 172.20.0.70 — 999391234567 -> 391234567
```

Same IP, **wrong** prefix — expect `403 Forbidden` with `Reason: Q.850;cause=21`:

```bash
docker run --rm --network audiotext_sip --ip 172.20.0.70 ctaloi/sipp \
    -sn uac -m 1 -d 100 -timeout 5s \
    -s "888391234567" -trace_msg kamailio-edge:5060
```

Known peer on an inactive trunk — expect `503` with `Reason: Q.850;cause=34`:

```bash
TRUNK=$(docker exec -i audiotext-postgres psql -U audiotext -d audiotext -t -A \
    -c "SELECT id FROM voice_trunks WHERE status='inactive' AND deleted_at IS NULL LIMIT 1;")
docker exec -i audiotext-postgres psql -U audiotext -d audiotext \
    -c "INSERT INTO voice_trunk_ips (voice_trunk_id, ip, status) VALUES ('$TRUNK', '172.20.0.51', 'active');"
docker exec audiotext-redis redis-cli PUBLISH lcr:reload x

docker run --rm --network audiotext_sip --ip 172.20.0.51 ctaloi/sipp \
    -sn uac -m 1 -d 100 -timeout 5s -trace_msg kamailio-edge:5060
```

Authorized source IP — seed first, then probe from a static docker IP:

```bash
docker exec -i audiotext-postgres psql -U audiotext -d audiotext <<'SQL'
INSERT INTO voice_trunk_ips (voice_trunk_id, ip, status)
SELECT id, '172.20.0.50', 'active'
FROM voice_trunks WHERE name='att-trunk-01' AND deleted_at IS NULL;
SQL

docker exec audiotext-redis redis-cli PUBLISH lcr:reload x

docker run --rm --network audiotext_sip --ip 172.20.0.50 ctaloi/sipp \
    -sn uac -m 1 -d 100 -timeout 10s kamailio-edge:5060
# expect 1 Successful call, INVITE forwarded to freeswitch
```

### Reload check

```bash
docker exec -i audiotext-postgres psql -U audiotext -d audiotext \
    -c "UPDATE voice_trunks SET status='inactive' WHERE name='att-trunk-01';"
docker exec audiotext-redis redis-cli PUBLISH lcr:reload x
docker logs --since 5s audiotext-sip-signaling   # "reload triggered", "loaded N IPs"
```

---

## Out of scope (future steps)

These are intentionally NOT implemented yet. Order roughly reflects expected sequencing.

1. Web admin publishes `lcr:reload` on every mutation that affects routing (trunk/ip/carrier/rate-sheet/numbering-plan create/update/delete/soft-delete). `apps/api` Hono routes need a small ioredis client + a `publishReload()` helper called from the relevant mutation handlers.
2. Carrier selection / LCR proper: numbering-plan match against the **stripped** B-number, rate-sheet lookup, ordered carrier list returned to Kamailio.
3. Per-trunk capacity / CPS enforcement using `voice_trunks.max_channels` / `cps_limit`. Returns `34` (capacity) or `42` (switch congestion) on hit.
4. Redis cache fallback layer (`tech_stack.md` charter) — Kamailio tries Redis first, falls through to Zig on miss. Survives a Zig restart with a short TTL.
5. P-Asserted-Identity for trusted A-number (replaces the spoofable `$fU`).
6. RTPEngine and a real media path. Required for wholesale carrier termination, not for the IVR.
7. Outbound call path (initiation from the admin/API side toward carriers).
8. IPv6 support, CIDR expansion (`voice_trunk_ips.ip` would need `inet` type or in-Zig CIDR parsing).
