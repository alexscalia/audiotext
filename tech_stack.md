# Tech Stack

## Web

- **Core:** Next.js + Tailwind + Radix UI
- **Data:** TanStack Table (logic) + TanStack Virtual (performance)
- **Analytics:** Tremor (high-density charts)
- **Backend & Safety:** Hono + Zod (shared types via RPC)
- **Fetching:** TanStack Query (syncs Hono data to tables)
- **DB:** Postgres

## SIP — Recommended Hybrid Architecture

Maximize active calls by avoiding "hairpinning" media through the application.

### Signaling Layer (Kamailio)

- Receives the `INVITE`.
- Queries the Zig signaling service (or a Redis cache populated by it) for the LCR decision.
- **Wholesale call:** rewrites SIP headers, forwards to carrier IP. Audio flows via RTPEngine.
- **IVR call:** routes to a FreeSWITCH cluster.

### Media Layer

- **RTPEngine** — sits on the edge. Relays raw UDP audio packets between customer and carrier. Near-zero CPU.
- **FreeSWITCH** — sits behind the firewall. Handles only the small share of traffic that needs actual file playback.
