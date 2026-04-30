# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from repo root unless noted. Package manager is **pnpm 10**, orchestrated by **Turborepo 2**. Node ≥ 25.6.0.

```bash
# first-time setup
cp .env.example .env
docker compose up -d postgres        # postgres:17 on :5432, adminer on :8080
pnpm install
pnpm db:generate && pnpm db:migrate
pnpm db:seed                         # creates admin001@admin.com / admin002@admin.com (pw: "password")

# everyday
pnpm dev                             # web :3000 + api :3001 in parallel via turbo
pnpm build
pnpm lint                            # ESLint via next lint (web only — api/db/shared have no lint)
pnpm typecheck                       # tsc --noEmit across all workspaces
pnpm format                          # prettier write

# DB workflow (drizzle-kit)
pnpm db:generate                     # generate SQL migration from schema.ts diff
pnpm db:migrate                      # apply migrations (runs packages/db/src/migrate.ts)
pnpm db:studio                       # drizzle-kit studio
pnpm db:seed                         # tsx packages/db/src/seed.ts
```

Targeting a single workspace:

```bash
pnpm --filter @audiotext/web dev
pnpm --filter @audiotext/api typecheck
pnpm --filter @audiotext/db db:push  # push schema without migration files (dev only)
```

There is **no test runner wired up yet** — `turbo run test` will no-op. Don't claim a feature is verified by tests until one is added.

## Architecture

### Workspace layout

```
apps/
  web/      Next.js 16.2 frontend (port 3000) — App Router, React 19.2, Tailwind 4, next-intl
  api/      Hono backend (port 3001) — @hono/node-server runtime, Better Auth mounted at /api/auth/*
packages/
  db/       Drizzle ORM schema + pg Pool client (@audiotext/db)
  shared/   Zod contracts shared between web + api (@audiotext/shared)
  tsconfig/ shared TS bases (base / nextjs / node)
crates/     reserved for future Rust port — empty stub today
```

### Backend (`apps/api`) — Hono on Node

Single entry: `apps/api/src/index.ts`. Uses `@hono/node-server`, `hono/cors`, `hono/logger`. The chained route registrations export an `AppType` (`export type AppType = typeof routes`) for future Hono RPC consumption from the web app — not wired into a client yet.

Runtime model: workspace packages `@audiotext/db` and `@audiotext/shared` ship raw TypeScript (`main: "./src/index.ts"`) — there is **no compile step that emits JS for them**. Both `dev` and `start` scripts run `tsx`, which transpiles workspace `.ts` on the fly. `build` is `tsc --noEmit` (typecheck only) — it does NOT produce a `dist/`. Don't try to `node dist/index.js`; it won't resolve workspace deps. If you ever need a real bundle for prod, you'll need to either build `@audiotext/db` + `@audiotext/shared` to JS and update their `main`, or bundle the api with tsup/esbuild and inline workspace code.

Better Auth lives in `apps/api/src/lib/auth.ts` (Drizzle adapter, `usePlural: true`, `generateId: false`, `emailAndPassword: { enabled: true }`). It's mounted in `index.ts` with `app.on(["GET","POST"], "/api/auth/*", c => auth.handler(c.req.raw))`. The Next-specific `nextCookies()` plugin was removed in the Hono port — Hono's CORS middleware with `credentials: true` covers cross-origin cookie behavior.

### Auth flow across the two apps

- `apps/web/next.config.ts` rewrites `/api/auth/:path*` → `${API_URL}/api/auth/:path*` (server-side proxy, keeps cookies first-party when the client uses the web origin).
- `apps/web/src/lib/auth-client.ts` calls `createAuthClient({ baseURL: NEXT_PUBLIC_API_URL })`. Currently that env var defaults to `http://localhost:3001` in `.env.example` — meaning the browser calls api directly (cross-origin), so the api server's CORS middleware (`origin: WEB_ORIGIN`, `credentials: true`) is what makes login work. If you want same-origin cookies via the rewrite instead, point `NEXT_PUBLIC_API_URL` at the web origin (or unset it). Both modes are viable; pick one and stick with it.

### Database conventions (`packages/db/src/schema.ts`)

The schema is the source of truth. Key conventions baked in across nearly every table — follow them when adding new tables:

- **UUID PKs**: `id: uuid("id").primaryKey().defaultRandom()`.
- **Soft delete everywhere**: every table has `deletedAt: timestamp(...).withTimezone`. Active-record uniqueness is enforced via *partial* unique indexes (`uniqueIndex(...).where(sql`${t.deletedAt} IS NULL`)`), not plain unique constraints. When you add new tables or query existing ones, filter on `isNull(deletedAt)` — see `packages/db/src/seed.ts` for the pattern.
- **Timestamps**: `createdAt` / `updatedAt` use `withTimezone: true`, with `$onUpdate(() => new Date())` on `updatedAt`.
- **Indexes on `deletedAt`** are present for query planner — add the same when creating new soft-deletable tables.
- Better Auth tables are pluralized (`users`, `sessions`, `accounts`, `verifications`) to match `usePlural: true` in the adapter config.

Migrations live in `packages/db/migrations/`. The flow is **schema-first**: edit `schema.ts`, run `pnpm db:generate`, review the SQL, then `pnpm db:migrate`. Don't hand-author migration SQL unless drizzle-kit can't express it.

### Shared contracts (`packages/shared/src/index.ts`)

Single-file Zod schema module. Used by both apps for input/output validation. When adding API routes, define the request/response shape here first, then import into both `apps/api` (use `@hono/zod-validator`'s `zValidator` middleware on Hono routes) and `apps/web` (for typed fetch results). For end-to-end type safety, prefer chaining new routes onto the `routes` const in `apps/api/src/index.ts` so they flow into the exported `AppType` — that's what a future `hc<AppType>()` client in web will consume.

### i18n (web only)

`next-intl` with cookie-based locale (`NEXT_LOCALE`):

- `apps/web/src/i18n/config.ts` — `locales = ["en", "it"]`, default `"en"`.
- `apps/web/src/i18n/request.ts` — `getRequestConfig` reads cookie; falls back to default. **No URL-based routing** — single locale per request via cookie.
- `apps/web/src/i18n/actions.ts` — `setLocale` server action sets the cookie + `revalidatePath("/", "layout")`.
- `apps/web/messages/{en,it}.json` — translation source.
- `apps/web/src/app/layout.tsx` wraps everything in `NextIntlClientProvider`.

When adding strings, add to **both** `en.json` and `it.json` — there is no fallback chain.

### Admin shell

`apps/web/src/app/admin/` has two segments:
- `login/page.tsx` — public, calls `signIn.email()` from `@/lib/auth-client`, redirects to `/admin/dashboard`.
- `(dashboard)/` — route group with shared `layout.tsx` wrapping pages in `<Sidebar />` + `<Header />` (`src/components/admin/`).

There is no auth guard on `(dashboard)` yet — adding one is a likely near-term task; gate it via Better Auth session check in the layout.

## TypeScript

All workspaces extend `packages/tsconfig/{base,nextjs,node}.json`. Notable strict-mode flags inherited from `base.json`: `strict`, `noUncheckedIndexedAccess`, `isolatedModules`. The `noUncheckedIndexedAccess` matters in practice — array/record reads return `T | undefined`, so `[first] = await db.select()...` patterns (used throughout `seed.ts`) need explicit undefined checks.
