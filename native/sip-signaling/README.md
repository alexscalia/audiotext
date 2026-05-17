# sip-signaling — call flow (IF/THEN)

Sequential steps from the moment a SIP `INVITE` hits the edge until it is accepted or rejected.

---

## Step 1 — INVITE arrives at Kamailio

1. Carrier sends `INVITE` to `kamailio-edge:5060` (UDP).
2. Kamailio extracts:
   - `$si` = source IP of the UDP datagram
   - `$fU` = A-number (From: user part)
   - `$rU` = B-number (Request-URI user part)

---

## Step 2 — Kamailio asks Zig

3. Kamailio calls `http_client_query`:
   ```
   GET http://sip-signaling:8080/authorize?ip=$si&a=$fU&b=$rU
   ```
4. **IF** the HTTP call times out or returns non-2xx
   **THEN** reply `503 Service Unavailable` + `Reason: Q.850;cause=41`. STOP.

---

## Step 3 — Zig receives the request

5. **IF** `ip` param missing → return `400 {"error":"missing ip"}`. STOP.
6. **IF** `a` param missing → return `400 {"error":"missing a"}`. STOP.
7. **IF** `b` param missing → return `400 {"error":"missing b"}`. STOP.
8. Zig URL-decodes `ip`, `a`, `b`.
9. Zig locks the cache mutex and looks up `ip` in the `StringHashMap`.

---

## Step 4 — Zig matches the credential

10. **IF** no entry exists for `ip` in the cache
    **THEN** return `{"allowed":0,"status":403,"cause":21}` (unknown peer). GOTO Step 6.

11. **ELSE** scan the per-IP credential list. For each credential `(prefix, active)`:
    - **IF** `prefix` is non-empty AND `b` starts with `prefix` → candidate
    - **IF** `prefix` is empty (NULL) → catch-all candidate

12. **IF** no candidate matches
    **THEN** return `{"allowed":0,"status":403,"cause":21}` (wrong prefix). GOTO Step 6.

13. **ELSE** pick the **longest** matching prefix (catch-all only wins if nothing specific matches).

14. **IF** chosen credential has `active=false` AND no other active credential also matches
    **THEN** return `{"allowed":0,"status":503,"cause":34}` (inactive). GOTO Step 6.

    > `active` = `voice_trunk_ips.status = 'active'` **AND** `voice_trunks.status IN ('active','testing')`. Both must hold. If parent trunk is `inactive` (or soft-deleted), the credentialx is `active=false` regardless of the ip-row's own status.

15. **ELSE** strip `prefix` from `b`. Call result `stripped`.

16. **Block-list scan** — first hit wins. **IF** any of the following match, return `{"allowed":0,"status":503,"cause":34}` (`blocked`). GOTO Step 6.
    - `a` starts with any prefix in `global_trunk_blocks.a_prefixes` (rows in `voice_trunk_blocked_prefixes` where `voice_trunk_id IS NULL` AND `party='a'`)
    - `stripped` starts with any prefix in `global_trunk_blocks.b_prefixes` (same table, NULL trunk, `party='b'`)
    - For the matched credential's trunk: `a` starts with any prefix in `trunk_blocks[trunk_id].a_prefixes` (per-trunk rows, `party='a'`)
    - For the matched credential's trunk: `stripped` starts with any prefix in `trunk_blocks[trunk_id].b_prefixes` (per-trunk rows, `party='b'`)
    - `a` starts with any prefix in `term_blocks.a_prefixes` (all rows from `at_voice_termination_blocked_prefixes` where `party='a'`, per-termination + global flattened)
    - `stripped` starts with any prefix in `term_blocks.b_prefixes` (same table, `party='b'`)

    > Block-set rows are loaded at boot/reload with `deleted_at IS NULL AND (expires_at IS NULL OR expires_at > now())`. A row whose `expires_at` passes mid-cache-lifetime keeps blocking until the next reload (reload latency is sub-50ms, so acceptable).
    >
    > Termination-side rows are flattened because signaling does not pick a termination yet (LCR not built). Once carrier selection lands, this scan will scope per-chosen-termination instead of flat.

17. **IF** `stripped` is NOT present in the `numbers` set
    **THEN** return `{"allowed":0,"status":503,"cause":34}` (DID not deliverable). GOTO Step 6.

    > The `numbers` set contains only DIDs that satisfy ALL of:
    > - row exists in `at_voice_numbers` AND not soft-deleted
    > - `user_id` is set AND points to a user that is `status='active'` AND not soft-deleted
    >
    > So this single check covers three failure modes: DID we don't own, DID assigned to no user, DID assigned to a user that is `pending` / `inactive` / `suspended` / `banned` / soft-deleted. All collapse to 503/34 (carrier may retry elsewhere).

18. **ELSE** return `{"allowed":1,"b":"<stripped>"}`.

---

## Step 5 — Kamailio reads the response

19. Kamailio parses JSON with `jansson_get` → `$var(allowed)`, `$var(status)`, `$var(cause)`, `$var(b)`.

20. **IF** `$var(allowed) == 1`
    **THEN**:
    - `$rU = $var(b)` (overwrite Request-URI user with the stripped B-number)
    - `record_route`
    - dispatcher picks a downstream (FreeSWITCH)
    - `t_relay`. STOP — call proceeds.

21. **ELSE** (`allowed == 0`):
    - `append_to_reply("Reason: Q.850;cause=$var(cause)\r\n")`
    - `sl_send_reply($var(status), "...")` (403 or 503)
    - STOP — call rejected.

---

## Step 6 — Upstream carrier reaction (informational)

22. **IF** `403 / cause=21` → carrier treats as permanent reject. STOP retrying.
23. **IF** `503 / cause=34` → carrier retries on alternate route (RFC 3326).
24. **IF** `503 / cause=41` → carrier retries (transient).

---

## Side flow — cache reload

A. Anyone publishes Redis message: `PUBLISH lcr:reload x`.
B. Zig subscriber thread wakes up.
C. Zig re-runs FOUR queries:
   ```sql
   -- 1. credentials (ip + prefix + active flag + trunk_id)
   SELECT vti.ip, COALESCE(vti.prefix, '') AS prefix,
          (vti.status='active' AND vt.status IN ('active','testing')) AS active,
          vt.id::text AS trunk_id
   FROM voice_trunk_ips vti
   JOIN voice_trunks    vt ON vt.id = vti.voice_trunk_id
   WHERE vti.deleted_at IS NULL AND vt.deleted_at IS NULL;

   -- 2. DIDs we own AND assigned to an active user
   SELECT n.number
   FROM at_voice_numbers n
   JOIN users u ON u.id = n.user_id
   WHERE n.deleted_at IS NULL
     AND u.deleted_at IS NULL
     AND u.status = 'active';

   -- 3. inbound (trunk-side) blocked prefixes
   --    voice_trunk_id NULL → global block, applies to every trunk
   SELECT COALESCE(voice_trunk_id::text, '') AS trunk_id, party, prefix
   FROM voice_trunk_blocked_prefixes
   WHERE deleted_at IS NULL
     AND (expires_at IS NULL OR expires_at > now());

   -- 4. outbound (termination-side) blocked prefixes
   --    per-termination and global rows are flattened (no LCR yet)
   SELECT party, prefix
   FROM at_voice_termination_blocked_prefixes
   WHERE deleted_at IS NULL
     AND (expires_at IS NULL OR expires_at > now());
   ```
D. Builds fresh maps for credentials, numbers set, per-trunk blocks, global trunk blocks, termination blocks. Swaps all five under one mutex, frees the old set.
E. Next INVITE sees the new state. Stale window ≈ <50ms.
F. **IF** subscriber loses connection → retries every 3s (`redis.zig`).

---

## Quick decision table

| Situation | SIP reply | Q.850 cause |
|---|---|---|
| Match + stripped B is owned DID + no block hit | `200` (relayed downstream) | — |
| IP unknown | `403` | `21` |
| IP known, no prefix match | `403` | `21` |
| Match found, credential inactive | `503` | `34` |
| Match + active, but A or stripped B hits a block prefix (trunk-side or termination-side) | `503` | `34` |
| Match + active + no block, but stripped B not in deliverable DID set (unknown, unassigned, or user not active) | `503` | `34` |
| Missing `ip` / `a` / `b` query param | `400` | — |
| Zig unreachable / timeout | `503` (kamailio fallback) | `41` |

---

## Auth rule (one sentence)

Credential = `(ip, prefix)`. Carrier authenticates by sending INVITE **from** the right IP **with** the agreed tech prefix on the B-number. Both must match a row in `voice_trunk_ips`. Longest prefix wins. Active shadows inactive. NULL prefix = catch-all.
