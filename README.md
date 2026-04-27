# audiotext

Monorepo. Next.js 16 frontend + backend, Postgres 17. Future: Rust backend port lives in `crates/`.

## Stack

- pnpm 10 + Turborepo 2
- Next.js 16.2 (App Router, Turbopack, TS, Tailwind)
- Drizzle ORM + node-postgres
- Zod shared contracts
- Postgres 17 via Docker Compose

## Layout

```
apps/
  web/      Next.js frontend (port 3000)
  api/      Next.js backend, route handlers only (port 3001)
packages/
  db/       Drizzle schema + client
  shared/   zod contracts shared across web + api
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

- web: http://localhost:3000
- api: http://localhost:3001/health
- adminer: http://localhost:8080

## Future Rust port

Backend contract lives in `packages/shared` (zod). Rust crate in `crates/api` will mirror those schemas (serde + manual or via `zod-to-json-schema` → `typify`). Drop `apps/api` when Rust crate hits parity.
