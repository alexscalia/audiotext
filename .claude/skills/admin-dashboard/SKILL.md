---
name: admin-dashboard
description: Use when scaffolding a new admin dashboard using the same stack, conventions, and visual system as the audiotext project — Next.js 16 App Router + Hono + Drizzle (Postgres) + Better Auth + next-intl + Tailwind 4 + react-hook-form + Zod + TanStack Table. Trigger on "admin dashboard", "scaffold admin", "new admin app", "audiotext-style admin".
argument-hint: "<project name> [optional: feature list]"
---

<Purpose>
Scaffold a new admin dashboard that mirrors the audiotext project's stack, layout, conventions, and component vocabulary. Output is a working `pnpm dev` monorepo with login, dashboard layout (collapsible sidebar + header + locale switcher + user menu), and one example list page wired end-to-end (web → rewrite → Hono → Drizzle).
</Purpose>

<Use_When>

- User wants a new admin app with the same look-and-feel as audiotext.
- User says "scaffold admin", "audiotext-style", "new admin dashboard", "set up admin shell".
- User asks to add a feature to an admin app and wants the existing patterns reused (list + form modal + zod contract).
  </Use_When>

<Do_Not_Use_When>

- User wants a public marketing site, mobile app, or non-admin SaaS surface.
- User wants shadcn/ui, MUI, Chakra, or any prebuilt component library — this stack is hand-rolled Tailwind.
- User asks for SSR data fetching with React Server Components throughout — current pattern is `"use client"` admin pages calling `/api/*` via fetch.
  </Do_Not_Use_When>

<Stack>
Pinned versions (match audiotext exactly unless user overrides):

- pnpm 11, Turborepo 2, Node ≥ 25.6.0
- Next.js 16.2 (App Router), React 19.2, Tailwind 4 (`@tailwindcss/postcss`)
- next-intl 4.x (cookie-based, no URL routing)
- Hono + `@hono/node-server` + `@hono/zod-openapi` + `@hono/swagger-ui` + `@hono/zod-validator`
- Better Auth 1.6 (Drizzle adapter, `usePlural: true`, `generateId: false`)
- Drizzle ORM + drizzle-kit + `pg` Pool (postgres:17)
- Zod 4, react-hook-form 7 + `@hookform/resolvers`
- `@tanstack/react-table` 8 (manual pagination/sorting/filtering)
- Geist + Geist Mono via `next/font/google`
  </Stack>

<Workspace_Layout>

```
apps/
  web/      Next.js (port 3000) — App Router, "use client" admin pages
  api/      Hono (port 3101) — Better Auth at /api/auth/*, OpenAPI at /docs
packages/
  db/       Drizzle schema + pg Pool (@<scope>/db, main: ./src/index.ts)
  shared/   Zod contracts shared web↔api (@<scope>/shared, main: ./src/index.ts)
  tsconfig/ shared bases (base, nextjs, node)
```

Critical: `@<scope>/db` and `@<scope>/shared` ship raw `.ts`. Both apps run via `tsx` with `--env-file=../../.env`. `build` is `tsc --noEmit` only — no `dist/`. Do NOT add a JS build step unless user explicitly requests prod bundling.
</Workspace_Layout>

<Routing_And_Auth>
Same-origin via Next.js rewrite — never cross-origin from the browser:

- `apps/web/next.config.ts`: rewrite `/api/:path*` → `${API_URL}/api/:path*`.
- `apps/web/src/lib/auth-client.ts`: `createAuthClient()` with **no `baseURL`**.
- `apps/api/src/index.ts`: `app.on(["GET","POST"], "/api/auth/*", c => auth.handler(c.req.raw))`.
- `apps/api/src/lib/auth.ts`: Drizzle adapter, `usePlural: true`, `generateId: false`, `emailAndPassword.enabled: true`, `trustedOrigins: [WEB_ORIGIN]`, secret from `BETTER_AUTH_SECRET`.

Do NOT add CORS middleware. Do NOT set `baseURL: NEXT_PUBLIC_API_URL` on the auth client.
</Routing_And_Auth>

<DB_Conventions>
Apply uniformly to every table:

- `id: uuid("id").primaryKey().defaultRandom()`
- `createdAt`/`updatedAt`: `timestamp(..., { withTimezone: true }).notNull().defaultNow()`; `updatedAt` adds `$onUpdate(() => new Date())`
- `deletedAt: timestamp(..., { withTimezone: true })` on every soft-deletable table
- Active uniqueness: `uniqueIndex("...").on(t.col).where(sql`${t.deletedAt} IS NULL`)` — partial, not plain unique
- `index("..._deleted_at_idx").on(t.deletedAt)` for query planner
- Better Auth tables pluralized: `users`, `sessions`, `accounts`, `verifications`
- Schema-first: edit `schema.ts` → `pnpm db:generate` → review SQL → `pnpm db:migrate`. Never hand-author SQL unless drizzle-kit can't express it.
- Queries filter `isNull(deletedAt)` everywhere.
  </DB_Conventions>

<I18n_Convention>

- Locales: `["en", "it"]`, default `"en"`, cookie `NEXT_LOCALE`, no URL prefix.
- `apps/web/src/i18n/{config,request,actions}.ts` — `setLocale` server action revalidates `/` layout.
- `apps/web/messages/{en,it}.json` — add every string to BOTH files. No fallback chain.
- Root layout wraps `<NextIntlClientProvider>`.
  </I18n_Convention>

<Visual_System>
Strict monochrome — black/white/gray. No accent color.

- Surfaces: `bg-white`, page bg `bg-gray-50`, dividers `border-gray-200`/`border-gray-100`.
- Primary text `text-black`, secondary `text-gray-600`/`text-gray-700`, muted `text-gray-500`/`text-gray-400`.
- Primary action: `bg-black text-white hover:bg-gray-800`.
- Focus: `focus:outline-none focus:ring-1 focus:ring-black` (or `ring-2` + `ring-offset-2` for prominent buttons).
- Active nav: `bg-black text-white`. Hover: `hover:bg-gray-100 hover:text-black`.
- Radius: `rounded-md` standard, `rounded-2xl` for modals, `rounded-full` for badges/avatars.
- Typography: `text-3xl font-bold tracking-tight` page titles, `text-lg font-semibold` section titles, `text-sm` body, `text-xs uppercase tracking-wide` table headers.
- Inputs: `rounded-md border border-gray-300 px-3 py-2.5 text-sm focus:border-black focus:ring-1 focus:ring-black`. Invalid: red-500 ring.
- Badges: pill `rounded-full px-2.5 py-1 text-xs`, tone variants success/neutral/warn/danger/info via `bg-*-50 text-*-700 ring-1 ring-*-200`.
- Always include `transition-colors duration-150 motion-reduce:transition-none`. Globals.css has a `prefers-reduced-motion` reset.
- Cursor: `cursor-pointer` on every interactive button/link.
- Icons: inline `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>` — no icon library.
  </Visual_System>

<Component_Vocabulary>
Reuse these primitives — do NOT replace with shadcn or alternatives:

- `components/ui/button.tsx` — variants: `primary | secondary | ghost | danger`, sizes `sm | md`, `forwardRef`.
- `components/ui/badge.tsx` — tones above, optional `withDot`.
- `components/ui/modal.tsx` — portal-free, `role="dialog" aria-modal`, focus restore, body-scroll lock, sizes `sm..3xl`, optional `subheader` sticky region, optional `footer` strip.
- `components/ui/search-input.tsx` — debounced upstream (300ms via `setTimeout`).
- `components/ui/actions-menu.tsx` — `createPortal` row-action menu with auto-flip on viewport edge.
- `components/ui/icons.tsx` — re-export per-icon SVG components (`EyeIcon`, `PencilIcon`, `TrashIcon`, `PlusIcon`, `SearchIcon`, `ChevronLeftIcon`).
- `components/ui/data-table/{data-table,sortable-header,pagination,types}.tsx` — TanStack Table v8 with manual pagination/sorting/filtering, `align: "right"` via `meta`.
- `components/form/{field,text-input,error-text,select}.tsx` — `Field` wraps label + control + error; controls use `forwardRef` for RHF.
- `components/shell/{sidebar,header,locale-switcher}.tsx` — sidebar collapse persisted to `localStorage["admin-sidebar-collapsed"]`, mobile drawer with backdrop, body-scroll lock, ESC close. Header has hamburger (mobile) + collapse toggle (desktop) + locale + avatar menu with sign-out.
- `components/layout/{page-header,breadcrumb}.tsx` — `PageHeader` with title/subtitle/eyebrow/actions/meta slots; `Breadcrumb` + `BackLink`.
  </Component_Vocabulary>

<Page_Patterns>
**Login** (`apps/web/src/app/admin/login/page.tsx`): `"use client"`, react-hook-form + zodResolver, `signIn.email()`, error codes mapped via `Login.serverErrors.<CODE>`, redirect to `/admin/dashboard`.

**Dashboard layout** (`apps/web/src/app/admin/(dashboard)/layout.tsx`): `"use client"`, `useSession()` guard with `router.replace("/admin/login")` when unauthenticated, skeleton during `isPending`, skip-to-content link, sidebar collapse state in `localStorage`, `<main id="main-content" tabIndex={-1}>`.

**List page** (e.g. `apps/web/src/app/admin/(dashboard)/<resource>/page.tsx`): `"use client"`, TanStack Table with `manualPagination/Sorting/Filtering`, debounced search (300ms), `useRef` request-id guard against stale responses, `AbortController` cleanup, fetch `/api/admin/<resource>?page=&pageSize=&sortBy=&sortDir=&search=`, `credentials: "include"`. Action column at `meta: { align: "right" }` rendering `<ActionsMenu>`.

**Form modal** (e.g. `components/features/<resource>/<resource>-form-modal.tsx`): `Modal` + RHF + zod from `@<scope>/shared`, post to `/api/admin/<resource>`, on success call parent `onCreated()` to refresh.
</Page_Patterns>

<API_Patterns>
**Layout** (mirror audiotext):

```
apps/api/src/
  index.ts                     OpenAPIHono root, logger, swagger, route mounts, graceful shutdown
  lib/
    auth.ts                    Better Auth instance (Drizzle adapter, usePlural, generateId:false)
    require-auth.ts            createMiddleware → reads session, 401 if absent, sets c.var.user
  routes/
    admin/
      <resource>.ts            one OpenAPIHono per resource, chained .openapi() handlers
```

**Root file** (`apps/api/src/index.ts`):

- `const app = new OpenAPIHono()` (NOT plain `Hono` — needed for OpenAPI doc generation).
- `app.use("*", logger())` first.
- Better Auth handler before resource routes: `app.on(["GET","POST"], "/api/auth/*", c => auth.handler(c.req.raw))`.
- `app.doc("/openapi.json", { openapi: "3.0.0", info: {...} })` + `app.get("/docs", swaggerUI({ url: "/openapi.json" }))`.
- Build `const routes = app.get(...).route("/api/admin/<x>", xRoutes)...` chain — every route mounted onto this single chain.
- `export type AppType = typeof routes` — preserves end-to-end types for future `hc<AppType>()` client.
- Capture server handle: `const server = serve({ fetch: app.fetch, port: PORT }, ...)`. SIGTERM/SIGINT → `server.close()` + `await pool.end()` + `process.exit(0)`.

**Auth middleware** (`apps/api/src/lib/require-auth.ts`):

```ts
import { createMiddleware } from "hono/factory";
import { auth } from "./auth";

export type AuthVariables = {
  user: { id: string; email: string };
};

export const requireAuth = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return c.json({ error: "unauthorized" }, 401);
    c.set("user", { id: session.user.id, email: session.user.email });
    await next();
  },
);
```

Every protected route attaches this via `middleware: [requireAuth] as const` in its `createRoute` definition. Do NOT call `getSession` inside handlers — middleware-only.

**Resource route shape** (`apps/api/src/routes/admin/<resource>.ts`):

- Use `@hono/zod-openapi`'s `OpenAPIHono` + `createRoute` — NOT `@hono/zod-validator` for new code. Schemas defined as `createRoute` `request`/`responses` are auto-validated AND auto-documented in OpenAPI.
- Import Zod schemas from `@<scope>/shared` (single source of truth web↔api). Use `*Schema` exports for `request.query` / `request.body` / `request.params` / `responses.200.content["application/json"].schema`.
- Tag each route (`tags: ["Carriers"]`) so swagger groups them.
- Always declare a `401: { description: "Unauthorized" }` response next to `requireAuth` middleware — keeps OpenAPI honest.
- Chain handlers on a single `OpenAPIHono<{ Variables: AuthVariables }>()` per file: `export const xRoutes = new OpenAPIHono<...>().openapi(routeA, h).openapi(routeB, h)`.
- In handlers, read validated input via `c.req.valid("query"|"param"|"json")` — already typed from the route schema.
- User from middleware: `c.var.user.id`.

**Drizzle query conventions**:

- Always filter `isNull(<table>.deletedAt)` in list/get/update.
- Build dynamic filters with `SQL[]` array + `and(...filters)`:
  ```ts
  const filters: SQL[] = [isNull(carriers.deletedAt)];
  if (search) {
    const term = `%${search}%`;
    const clause = or(
      ilike(carriers.name, term),
      ilike(carriers.businessName, term),
    );
    if (clause) filters.push(clause);
  }
  ```
- Aggregate counts via ``sql<number>`count(${joined.id})::int` `` — cast to int (Postgres `count` is bigint, arrives as string otherwise).
- Sort: build `orderColumn` via `switch` on validated `sortBy` enum, then `sortDir === "asc" ? asc(col) : desc(col)`. Add stable tiebreaker `desc(<table>.id)` so pagination doesn't drift.
- Pagination: parallelize via `Promise.all([rowsQuery, countQuery])`. Compute `offset = (page - 1) * pageSize`. Read `totalRow[0]?.count ?? 0` (noUncheckedIndexedAccess).
- Convert `Date` columns to ISO strings before returning: `r.createdAt.toISOString()` — Zod response schema expects `z.string().datetime()`.

**Pagination response shape** (Zod-locked):

```ts
{ <items>: T[], total: number, page: number, pageSize: number }
```

Plural key matches the resource (`carriers`, `plans`, etc.).

**Shared Zod contract pattern** (`packages/shared/src/index.ts`):
For each list endpoint, export:

- `<X>ListSortByEnum = z.enum([...])` + `<X>ListSortBy` type
- `<X>ListSortDirEnum = z.enum(["asc","desc"])`
- `<X>ListQuerySchema` — `page: z.coerce.number().int().min(1).default(1)`, `pageSize: z.coerce.number().int().min(1).max(100).default(10)`, `search: z.string().trim().max(200).optional()`, `sortBy/sortDir` with defaults.
- `<X>ListItemSchema` (row — dates as `z.string().datetime()`)
- `<X>ListResponseSchema = z.object({ <items>: z.array(<X>ListItemSchema), total, page, pageSize })`

`z.coerce.number()` is required — query strings arrive as `string`.

**Error handling**: don't add custom error middleware unless asked. Better Auth + zod-openapi auto-return 400/401/422. Throw `HTTPException` from `hono/http-exception` for explicit non-2xx (`throw new HTTPException(404, { message: "not found" })`).

**No CORS**: web is same-origin via Next rewrite. Adding `cors()` from `hono/cors` is an anti-pattern — only add scoped to a specific route if a real third-party origin appears.

**Mount order** in `index.ts`: logger → Better Auth `/api/auth/*` → OpenAPI doc → swagger → resource routes → 404 fallback. Better Auth must precede resource routes since they share `/api`.
</API_Patterns>

<DB_Package>
`packages/db/` ships raw TS. Layout:

```
packages/db/
  drizzle.config.ts           dialect: "postgresql", schema: "./src/schema.ts", out: "./migrations", strict: true
  package.json                main: "./src/index.ts", exports "." + "./schema"
  migrations/                 generated SQL — never hand-edit
  src/
    index.ts                  re-exports client + schema
    client.ts                 pg Pool from DATABASE_URL, drizzle(pool, { schema })
    schema.ts                 source of truth — see <DB_Conventions>
    migrate.ts                applies migrations on demand
    reset.ts                  refuses if NODE_ENV=production; drops public + drizzle schemas
    seed.ts                   admin users, roles, base data
```

Scripts (all use `tsx --env-file=../../.env`):

- `db:generate` → drizzle-kit generate (diff schema → new SQL file in `migrations/`)
- `db:migrate` → applies pending migrations
- `db:studio` → drizzle-kit studio
- `db:push` → push schema without generating files (dev-only, avoid for shared work)
- `db:seed` → tsx seed.ts
- `db:reset` → reset.ts && db:migrate && db:seed (refuses in prod)

**Seeding admin users**: do NOT insert raw passwords. Use `better-auth/crypto`'s `hashPassword`, then upsert credential `accounts` row with `providerId: "credential"`, `accountId: <userId>`, `password: <hash>`. Audiotext `seed.ts` pattern: ensure admin role, create user if missing, upsert credential account with hashed password — reuse verbatim.
</DB_Package>

<API_Verification>
Smoke-test the API independently of the web app:

- `curl http://localhost:3101/health` → `{ ok: true, ts: "..." }`
- `curl http://localhost:3101/openapi.json | jq '.paths | keys'` — every mounted route appears.
- Visit `http://localhost:3101/docs` — swagger lists routes grouped by tag, protected routes show 401 example.
- Auth probe: `curl -i http://localhost:3101/api/admin/<resource>` without cookie → 401. With session cookie from logged-in browser → 200.
- Shutdown: `kill -TERM <pid>` prints `SIGTERM received, shutting down` and exits 0 (proves `pool.end()` ran).
  </API_Verification>

<TS_Strict>
All workspaces extend `packages/tsconfig/{base,nextjs,node}.json`. `noUncheckedIndexedAccess` is on — destructured `[first] = await db.select()...` is `T | undefined`; guard explicitly.
</TS_Strict>

<Steps>
1. **Confirm scope**: ask user for project name (workspace `@<scope>/*`), DB name, port overrides if any, and which features beyond the auth shell + a sample resource list page.
2. **Plan first** (project CLAUDE.md mandates plan mode for 3+ steps): write `tasks/todo.md` with checkable steps and confirm before generating files.
3. **Scaffold**:
   - Root: `package.json` (pnpm 11, turbo 2, scripts mirror audiotext), `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.json`, `.env.example`, `docker-compose.yml` (postgres:17), `.gitignore`.
   - `packages/tsconfig` (base/nextjs/node).
   - `packages/db`: `src/{index,schema,migrate,seed}.ts`, `drizzle.config.ts`, scripts (`db:generate`, `db:migrate`, `db:studio`, `db:seed`, `db:reset` with `NODE_ENV=production` refusal).
   - `packages/shared`: `src/index.ts` with Zod schemas for the resources requested.
   - `apps/api`: `src/index.ts` (Hono+OpenAPI+swagger-ui), `src/lib/auth.ts`, one route module per resource, `dev`/`start` use `tsx --env-file=../../.env`.
   - `apps/web`: `next.config.ts` (rewrite + `createNextIntlPlugin`), `postcss.config.mjs` (`@tailwindcss/postcss`), `src/app/{layout,page,globals.css}`, `src/i18n/{config,request,actions}.ts`, `messages/{en,it}.json`, full `components/{ui,form,shell,layout,features}` per `<Component_Vocabulary>`, admin shell (`login`, `(dashboard)/layout.tsx`, `(dashboard)/dashboard/page.tsx`, one resource list page).
4. **DB bootstrap**: write `schema.ts` per `<DB_Conventions>` (Better Auth tables + requested resources), generate + apply first migration, seed two admin users (`admin001@admin.com`/`admin002@admin.com`, password `password`) via Better Auth's sign-up so credentials hash correctly.
5. **Wire one full vertical**: list endpoint (api) → zod contract (shared) → list page with table/search/pagination + create modal (web). Prove the loop works.
6. **Verify**:
   - `pnpm install`, `docker compose up -d postgres`, `pnpm db:generate && pnpm db:migrate && pnpm db:seed`.
   - `pnpm typecheck` clean across all workspaces.
   - `pnpm dev` boots web :3000 + api :3101.
   - Manually (or via Playwright if available) sign in at `/admin/login`, hit dashboard, hit the list page, create one row, confirm it appears.
7. **Document**: write `CLAUDE.md` mirroring audiotext's structure (Workflow Orchestration, Commands, Architecture sections).
</Steps>

<Anti_Patterns>
Do not:

- Use `baseURL` on `createAuthClient()` or add CORS — kills the same-origin design.
- Compile `packages/db`/`packages/shared` to JS — both apps run TS via `tsx` directly.
- Skip `--env-file=../../.env` on new api scripts — `tsx` will not load `.env` otherwise.
- Hand-author migration SQL when drizzle-kit can express it.
- Add a UI library (shadcn/Radix/MUI) — components are intentionally hand-rolled Tailwind.
- Introduce a color palette beyond black/white/gray + tone-scoped semantic colors on badges/errors.
- Use plain `unique()` for active-record uniqueness on soft-deletable tables — must be partial unique index `WHERE deleted_at IS NULL`.
- Rely on URL-based locale routing — locale lives in the `NEXT_LOCALE` cookie.
- Add tests claiming feature verification — there's no runner wired up; say so explicitly.
  </Anti_Patterns>

<Verification_Checklist>
Before declaring done:

- [ ] `pnpm typecheck` passes on every workspace.
- [ ] `pnpm dev` brings up web + api with no console errors.
- [ ] `/admin/login` accepts seeded admin and redirects to `/admin/dashboard`.
- [ ] Sidebar collapse persists across reload; mobile drawer opens + ESC closes.
- [ ] Locale switcher toggles `en`↔`it` and content updates after revalidation.
- [ ] Sample list page paginates, sorts, searches, and creates a row through the form modal.
- [ ] Soft-delete: deleting a row hides it from the list but row remains in DB with `deleted_at` set.
- [ ] OpenAPI doc reachable at `http://localhost:3101/docs`.
      </Verification_Checklist>
