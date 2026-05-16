# sip-signaling — Zig LCR / authorization engine

Latency-critical service queried by Kamailio on every incoming SIP `INVITE`. Holds carrier/trunk routing state in memory; reloads on Redis pub/sub.

Lives at `native/sip-signaling/`. Built with Zig 0.14, links `libpq` (Postgres) and `libhiredis` (Redis). Runs as a Docker container on the `sip` network.

---

## Step 1 — what is implemented today

**Single question:** is the source IP of the INVITE authorized to send calls to us?

The answer is one of three states. The three states map to distinct SIP responses because they mean very different things to an upstream carrier.

| Lookup state | When it happens | SIP response | Q.850 cause | Upstream behavior |
|---|---|---|---|---|
| `active` | row exists in `voice_trunk_ips` (not soft-deleted), `ip.status='active'`, parent `voice_trunks` not soft-deleted and `vt.status IN ('active','testing')` | call relayed | — | normal |
| `inactive` | row exists for this IP but `ip.status='inactive'` OR parent trunk is `inactive` | `503 Service Unavailable` | `34` (no circuit/channel available) | typically retries on alternate carrier per RFC 3326 |
| `unknown` | no row for this IP (or every matching row is soft-deleted) | `403 Forbidden` | `21` (call rejected) | stops retrying — permanent rejection |

The split exists for two reasons:

1. **Carrier signaling.** `503 + cause 34` invites the upstream to retry on another route — appropriate for a known peer that's temporarily down. `403 + cause 21` tells them "don't bother, this won't change" — appropriate for an unknown IP that's likely a scanner or a spoofed source.
2. **Operational signal.** Logs and metrics can split scanners/spoofs from real ops issues. A spike in cause 21 = abuse traffic; a spike in cause 34 = a carrier or trunk genuinely broken.

`testing` is treated as `active` so ops can validate a new carrier trunk end-to-end before promoting it. `inactive` is treated as known-but-down. Soft-deleted (`deleted_at IS NOT NULL` on either side) collapses to `unknown` — the trunk is considered gone, not paused.

Nothing else is decided yet. No carrier selection, no rate-sheet lookup, no number/prefix routing — those are future steps.

---

## Architecture

```
                   ┌─────────────────────────────┐
INVITE  ──udp/5060─►  kamailio-edge              │
                   │  request_route { ... }      │
                   └──────┬──────────────────────┘
                          │ http_client_query
                          │ GET /authorize?ip=$si
                          ▼
                   ┌─────────────────────────────┐
                   │  sip-signaling (Zig)        │
                   │  ────────────────────────── │
                   │  StringHashMap<ip → void>   │  ◄── mutex-guarded
                   │  ────────────────────────── │
                   │  HTTP/1.1 :8080             │
                   └──────┬──────────────────────┘
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
3. Zig URL-decodes each param, takes the cache mutex briefly, looks the IP up. Returns one of:
   - `{"allowed":1}` (accept)
   - `{"allowed":0,"status":403,"cause":21}` (unknown peer)
   - `{"allowed":0,"status":503,"cause":34}` (known but inactive)

   A/B are logged today but do not yet affect the decision.
4. Kamailio runs `jansson_get` on `allowed`, `status`, `cause`. If `allowed != 1` → `append_to_reply("Reason: Q.850;cause=$var(cause)\r\n")` + `sl_send_reply` with the SIP status code (`403` or `503`). Otherwise → `record_route` + dispatcher pick + `t_relay`.

No Postgres roundtrip on the hot path. Single in-memory `StringHashMap` lookup. SIP status + Q.850 cause are both chosen by Zig so future rejection paths can pick richer codes without touching `kamailio.cfg`.

---

## Data load (boot + reload)

Run once at startup, and again on every Redis `lcr:reload` message:

```sql
SELECT vti.ip,
       (vti.status = 'active'
        AND vt.status IN ('active', 'testing')) AS active
FROM voice_trunk_ips vti
JOIN voice_trunks    vt ON vt.id = vti.voice_trunk_id
WHERE vti.deleted_at IS NULL
  AND vt.deleted_at  IS NULL;
```

Every non-deleted `(ip, trunk)` pair is loaded; the SQL collapses the ip-row status and parent-trunk status into a single boolean. The result populates a fresh `StringHashMap(Entry { active: bool })` (3-state lookup: `unknown` if no row, `active`/`inactive` from the boolean). Map is atomically swapped under a `std.Thread.Mutex`. The old map's keys are freed after the swap.

The SQL columns and table names come straight from `packages/db/src/schema.ts` (`voiceTrunks` + `voiceTrunkIps`). The relevant indexes that make this query fast already exist:

- `voice_trunks_status_idx`, `voice_trunks_deleted_at_idx`
- `voice_trunk_ips_status_idx`, `voice_trunk_ips_deleted_at_idx`, `voice_trunk_ips_trunk_idx`

---

## HTTP API

| Route | Method | Response |
|---|---|---|
| `/authorize?ip=<IPv4>&a=<from-user>&b=<r-uri-user>` | GET | one of: `200 {"allowed":1}` / `200 {"allowed":0,"status":403,"cause":21}` / `200 {"allowed":0,"status":503,"cause":34}` |
| `/authorize` (no `ip`) | GET | `400 {"error":"missing ip"}` |
| `/healthz` | GET | `200 ok` |
| anything else | GET | `404 {"error":"not found"}` |

**Why GET (not POST):** decision is read-only + idempotent (same `(ip,a,b)` → same answer), cacheable, debuggable from curl. A-number / B-number are not secrets — they already travel in the SIP message in plaintext. Switch to POST only if the param set grows past ~5–6 values or we need to ship arrays.

**Query parameters:**

- `ip` (required) — taken from Kamailio's `$si`, exact source IP of the UDP datagram. IPv4 only for now. Drives the authorization decision.
- `a` (optional) — A-number / calling party. Kamailio sends `$fU` (`From:` user part). Logged today; will feed CDRs and per-carrier billing later. Carriers can spoof `From:` — for trust we'll switch to `$(hdr(P-Asserted-Identity){nameaddr.uri})` once we have trusted-peer config.
- `b` (optional) — B-number / called party. Kamailio sends `$rU` (Request-URI user). Logged today; will drive numbering-plan / LCR lookup in Step 2.

All values are URL-decoded server-side per RFC 3986 (`%XX` only — `+` is preserved literally, since SIP user parts may contain `+E.164` prefixes).

**Why integer (`1`/`0`) and not `true`/`false`:** Kamailio's `$var()` variables are typed at first assignment. `jansson_get` of a JSON bool ends up int-typed; comparing `$var(allowed) != "true"` then triggers an auto string-to-int coerce on the literal `"true"`, which fails and the whole `if` expression evaluates false (silently lets traffic through). Returning an int keeps both sides of the comparison int.

**Why `cause` is sourced from Zig (not hardcoded in `kamailio.cfg`):** the rejection reason is a *policy* decision (which Q.850 code best signals what went wrong). Zig owns the policy; kamailio just transports it. This keeps the wire format stable as more rejection paths land — kamailio doesn't need editing every time a new cause appears. Today only `34` (no circuit/channel) is emitted; Step 2 will fan out into the rest of the Q.850 set (21 = call rejected, 38 = network out of order, 41 = temporary failure, etc.).

When `allowed == 1` the response does **not** include `cause` — there is no rejection to describe. Kamailio reads `cause` only after seeing `allowed != 1`.

---

## SIP + Q.850 mapping

| Trigger | Who picks values | SIP status | Reason header |
|---|---|---|---|
| signaling service unreachable (timeout / connection refused) | Kamailio (hardcoded fallback) | `503 Service Unavailable` | `Reason: Q.850;cause=41` |
| Zig returns `unknown` (no row for source IP) | Zig response (`status`, `cause`) | `403 Forbidden` | `Reason: Q.850;cause=21` |
| Zig returns `inactive` (ip or trunk disabled) | Zig response (`status`, `cause`) | `503 Service Unavailable` | `Reason: Q.850;cause=34` |

In Step 1 only the three values above are emitted. Once Step 2 lands (LCR, rate sheets, B-number gating), the same wire path will carry richer codes without any `kamailio.cfg` churn — Zig flips the policy, kamailio just forwards. Likely additions: `21` for blocked B-number, `38` for missing rate sheet, `41` for transient backend failure.

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
curl 'http://localhost:8088/healthz'
curl 'http://localhost:8088/authorize?ip=<some-active-ip>'   # expect {"allowed":1}
curl 'http://localhost:8088/authorize?ip=8.8.8.8'             # expect {"allowed":0}
```

### SIP probe via sipp

Unauthorized source IP — expect `503` with `Reason: Q.850;cause=34`:

```bash
docker run --rm --network audiotext_sip ctaloi/sipp \
    -sn uac -m 1 -d 100 -timeout 5s -trace_msg kamailio-edge:5060
# tail the trace; the 503 must include the Reason header
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
2. Carrier selection / LCR proper: rate-sheet lookup, numbering-plan match by destination prefix, ordered carrier list returned to Kamailio.
3. Richer Q.850 mapping (cause 1 = unallocated number, 16 = normal call clearing, 21 = call rejected, 38 = network out of order, …) once the routing decisions that produce them exist.
4. Redis cache fallback layer (`tech_stack.md` charter) — Kamailio tries Redis first, falls through to Zig on miss. Survives a Zig restart with a short TTL.
5. RTPEngine and a real media path. Required for wholesale carrier termination, not for the IVR.
6. Outbound call path (initiation from the admin/API side toward carriers).
7. Per-trunk capacity/CPS enforcement using `voice_trunks.max_channels` / `cps_limit`.
8. IPv6 support, CIDR expansion (`voice_trunk_ips.ip` would need `inet` type or in-Zig CIDR parsing).
