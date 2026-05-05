# audiotext

Monorepo. Next.js 16 frontend, Hono backend, Postgres 17. Future: Rust backend port lives in `crates/`.

## Stack

- pnpm 10 + Turborepo 2
- **Frontend:** Next.js 16.2 (App Router, Turbopack, TS) + Tailwind + Radix UI
- **Data tables:** TanStack Table (logic) + TanStack Virtual (perf)
- **Analytics:** Tremor (high-density charts)
- **Backend:** Hono + Zod (shared types via RPC, OpenAPI spec via `@hono/zod-openapi`)
- **Auth:** Better Auth (sessions + Drizzle adapter, shared between web + api)
- **Fetching:** TanStack Query (syncs Hono data into tables)
- **DB:** Postgres 17 via Docker Compose, Drizzle ORM + node-postgres

## Layout

```
apps/
  web/      Next.js frontend (port 3000)
  api/      Hono backend, RPC + route handlers (port 3001)
packages/
  db/       Drizzle schema + client
  shared/   Zod contracts shared across web + api (Hono RPC types)
  tsconfig/ shared tsconfig bases
crates/     reserved for future Rust backend port
```

## Dev

```bash
cp .env.example .env
docker compose up -d postgres
pnpm install
pnpm db:generate && pnpm db:migrate
pnpm dev
```

### DB scripts

- `pnpm db:generate` — generate SQL migration from schema.ts diff
- `pnpm db:migrate` — apply pending migrations
- `pnpm db:seed` — seed dev data
- `pnpm db:studio` — open drizzle-kit studio
- `pnpm db:reset` — **dev only**, drops `public` schema, re-runs migrate + seed (refuses if `NODE_ENV=production`)

- web: http://localhost:3000
- api: http://localhost:3001/health
- api docs (Swagger UI): http://localhost:3001/docs
- api OpenAPI spec: http://localhost:3001/openapi.json

## Future Rust port

Backend contract lives in `packages/shared` (Zod) and is exposed to the web app via Hono RPC. Rust crate in `crates/api` will mirror those schemas (serde + manual or via `zod-to-json-schema` → `typify`) and re-expose the same routes. Drop `apps/api` when Rust crate hits parity.
