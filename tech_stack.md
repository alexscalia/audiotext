# Tech Stack

## Web

- **Core:** Next.js 16 (App Router) + Tailwind 4 + custom hand-rolled UI primitives (no Radix/shadcn — see CLAUDE.md and `apps/web/src/components/ui/`).
- **Data:** TanStack Table (logic) + TanStack Virtual (performance).
- **Charts:** Recharts (Tremor v3 was rejected — incompatible with Tailwind 4).
- **Backend & Safety:** Hono + `@hono/zod-openapi` + Zod, with shared types via RPC (`apps/web/src/lib/api-client.ts` calls `hc<AppType>("/")`).
- **Fetching:** TanStack Query 5 (cache, dedup, cancellation) wrapped by `useListData` / `useResource` hooks. `QueryProvider` mounted in root layout.
- **Auth:** Better Auth 1.6 (Drizzle adapter) — same-origin via Next rewrite, no CORS.
- **DB:** Postgres 17 (Drizzle ORM, soft-delete + partial unique indexes everywhere).

## SIP — Recommended Hybrid Architecture

Maximize active calls by avoiding "hairpinning" media through the application.

### Signaling Layer (Kamailio)

- Receives the `INVITE` from carrier or customer.
- Queries the Zig signaling service (or a Redis cache populated by it) for the LCR decision.
- **Wholesale call:** rewrites SIP headers, forwards to carrier IP. Audio flows via RTPEngine.
- **IVR call:** routes to a FreeSWITCH cluster.

### Media Layer

- **RTPEngine** — sits on the edge. Relays raw UDP audio packets between customer and carrier. Near-zero CPU.
- **FreeSWITCH** — sits behind the firewall. Handles only the small share of traffic that needs actual file playback.

## Native (Zig)

Lives at `native/` (top-level workspace, sibling to `apps/` and `packages/`). Holds latency-critical services that can't tolerate Node + Postgres roundtrips on the SIP hot path. Zig (not Rust) — directory naming intentionally avoids Cargo's `crates/` convention.

### `native/sip-signaling/` — LCR lookup engine

- **Queried by Kamailio** on every `INVITE` over UDP (preferred) or HTTP. Latency budget: <5ms p99.
- **Holds in memory:** carrier table, voice rate sheets (joined to numbering plans), trunk → carrier mapping, status filters. Loaded from Postgres on startup.
- **Cache invalidation:** subscribes to Redis pub/sub channel `lcr:reload`. The web admin (`apps/api`) publishes to this channel after any mutation that affects routing (carrier/trunk/rate sheet/numbering plan create/update/delete/soft-delete). Service does an in-memory swap — no Postgres requery on hot path.
- **Cache fallback:** also writes resolved LCR decisions into Redis with a short TTL (~30s). Kamailio config tries Redis first; on cache miss falls through to the Zig service. This survives a brief Zig restart.
- **Returns:** chosen carrier IP + trunk ID + estimated rate (for billing pre-check) + decision-trace ID (for CDR correlation).

### Build / deploy

- One Zig project per service (`native/<service>/build.zig`).
- Container image per service. Compose-mounted for dev, Kubernetes Deployment for prod.
- No shared Zig library across services until a real cross-cutting concern appears (avoid premature abstraction).

### What does NOT belong in `native/`

- CRUD endpoints — those stay in `apps/api` (Hono + Drizzle).
- Anything queried by the browser — the admin web app talks to Hono only.
- One-shot batch jobs — write a `tsx` script under `apps/api/scripts/` instead.
