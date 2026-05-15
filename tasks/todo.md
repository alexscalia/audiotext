# audiotext — project status

Last updated: 2026-05-15.

## Web admin (apps/web + apps/api)

- [x] Next.js 16 + Tailwind 4 + next-intl + Better Auth shell.
- [x] TanStack Query mounted in root layout.
- [x] Hono RPC client wired (`apps/web/src/lib/api-client.ts` consuming `AppType` from api).
- [x] `useListData` + `useResource` hooks refactored to `queryKey + queryFn` shape, all callers migrated.
- [x] Detail-page metadata workaround applied (Next 16 dynamic-segment template bug → `title.absolute`).
- [x] Radix uninstalled; custom UI primitives stay (modal, actions-menu, select, hover-tooltip).
- [x] Recharts installed (no chart UI yet).
- [ ] Mutations (create/update/delete) via `useMutation` + `queryClient.invalidateQueries`. Read side proven, write side TBD.
- [ ] Auth guard on `/admin/(dashboard)` layout — confirm `useSession` redirect already in place, otherwise add.
- [ ] Dashboard charts (Recharts) once real metrics endpoint exists.
- [ ] Test runner (`vitest` or similar) — `pnpm test` currently no-ops.

## SIP infra (infra/sip + docker-compose.sip.yml)

- [x] Kamailio 5.8 LTS image, multi-arch (built locally — upstream `kamailio/kamailio-ci` only had amd64 5.5.2).
- [x] Edge proxy: dispatcher set 1 → IVR target. In-dialog ACK/BYE/CANCEL absorbed.
- [x] Carrier-sink container (unused for now, kept for future wholesale split).
- [x] FreeSWITCH 1.10.12 built from source (no SignalWire token; multi-stage Dockerfile, native arm64). `mod_signalwire`, `mod_verto`, `mod_av` disabled to skip libks/libav deps.
- [x] FS catch-all dialplan in `public` context: answer → playback → hangup.
- [x] Sample audio (`infra/sip/freeswitch/audio/welcome.wav`, 8 kHz mono PCM, generated via macOS `say` + `afconvert`).
- [x] **Smoke test passed:** sipp → kamailio-edge → dispatcher → freeswitch → playback → hangup → BYE. `Successful call: 1, Failed call: 0`. Evidence: FS log shows `EXECUTE playback(...)` then `done playing file`.
- [ ] Forward calls to external IPs (next-up SIP feature). Add prefix-matched extension that does `<action application="bridge" data="sofia/external/sip:user@target_ip:port"/>`.
- [ ] Zig LCR service (replaces hardcoded `dispatcher.list`). Reads carriers/trunks/rate-sheets from Postgres, watches Redis pub/sub for invalidation, answers Kamailio queries on hot path. Lives at `native/sip-signaling/`.
- [ ] RTPEngine for real RTP audio path (only when wholesale carrier path comes online). Mac Docker UDP port-range mapping is finicky.
- [ ] FS module hardening — currently runs as `freeswitch` user, no SCHED_FIFO (warning is benign in container). Optional: add capabilities for SCHED_FIFO if dev-rig latency ever matters.

## Docs / skills updated this session

- `CLAUDE.md` — `crates/` → `native/` (Zig, not Rust).
- `tech_stack.md` — Web section refreshed (drop Radix/Tremor, add Hono RPC + Query). Added `## Native (Zig)` charter section.
- `.claude/skills/admin-dashboard/SKILL.md` — full refresh: stack, vocabulary, hooks, list-page pattern (RPC + Query), form-modal pattern, page metadata workaround, anti-patterns, verification checklist.
- `.claude/skills/freeswitch-source-build/` — new skill captured the multi-stage source-build pattern (no SignalWire token).

## How to run

```bash
# Web admin
docker compose up -d postgres
pnpm install && pnpm db:generate && pnpm db:migrate && pnpm db:seed
pnpm dev                    # web :3000, api :3101

# SIP dev rig
docker compose -f docker-compose.sip.yml up -d --build
docker compose -f docker-compose.sip.yml logs -f

# Smoke test the IVR path
docker run --rm --network audiotext-sip_sip ctaloi/sipp \
  -sn uac kamailio-edge:5060 -m 1 -r 1 -timeout 15s -nostdin
# → Successful call: 1
```

## Known gaps / non-blockers

- Kamailio prints `WARNING ... could not rev. resolve 0.0.0.0` at startup. Cosmetic, ignore.
- FS prints `Failed to set SCHED_FIFO scheduler` at startup. Container running unprivileged, expected.
- `apps/web` lint shows 1 warning on `data-table-card.tsx` (TanStack Table incompat with React Compiler memoization). Pre-existing, not our work.
- Carrier-sink is in compose but never dispatched to. Keep until wholesale path lands, then either delete or wire as a real-vs-fake-carrier toggle.
