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
- `@tanstack/react-query` 5 + `@tanstack/react-query-devtools` (cache/dedup/cancellation for all client data fetching)
- `hono` (client side too — for `hc<AppType>()` typed RPC)
- `recharts` for charts (Tremor v3 NOT compatible with Tailwind 4 — never install Tremor here)
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

**TanStack Query provider** is mounted in the root layout INSIDE `NextIntlClientProvider`:

```tsx
// apps/web/src/app/layout.tsx
<NextIntlClientProvider locale={locale} messages={messages}>
  <QueryProvider>{children}</QueryProvider>
</NextIntlClientProvider>
```

`QueryProvider` (`apps/web/src/components/providers/query-provider.tsx`) is `"use client"`, instantiates `QueryClient` via `useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 } } }))`, mounts `<ReactQueryDevtools initialIsOpen={false} />` only in `process.env.NODE_ENV === "development"`.

**Hono RPC client** (`apps/web/src/lib/api-client.ts`):

```ts
import { hc } from "hono/client";
import type { AppType } from "../../../api/src/index";

export const api = hc<AppType>("/");
export type ApiClient = typeof api;
```

Base URL is `"/"` — same-origin via the existing rewrite. Cross-workspace type-only import is fine; web's tsconfig + `moduleResolution: "bundler"` resolves it. End-to-end type inference flows from backend Zod schemas (catches things like `locale` enum mismatches at typecheck time).
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
- `components/ui/data-table/{data-table,sortable-header,pagination,types,data-table-card,column-filter,standard-row-actions}.tsx` — TanStack Table v8 with manual pagination/sorting/filtering, `align: "right"` via `meta`. `DataTableCard` is the shell every list page renders (filters slot + table + pagination + empty/loading/no-results labels). `ColumnFilterDropdown` powers in-header status/enum filters. `StandardRowActions` is the canonical row-action menu (view/edit/delete) used by every list page.
- `components/ui/hover-tooltip.tsx` — CSS-only hover tooltip used in table cells (e.g. expanded IP list, code list).
- `components/ui/status-badge.tsx` — wraps `Badge` with a tone map keyed off the row's status enum.
- `components/form/{field,text-input,error-text,select}.tsx` — `Field` wraps label + control + error; controls use `forwardRef` for RHF.
- `components/shell/{sidebar,header,locale-switcher}.tsx` — sidebar collapse persisted to `localStorage["admin-sidebar-collapsed"]`, mobile drawer with backdrop, body-scroll lock, ESC close. Header has hamburger (mobile) + collapse toggle (desktop) + locale + avatar menu with sign-out.
- `components/layout/{page-header,breadcrumb,detail-header}.tsx` — `PageHeader` with title/subtitle/eyebrow/actions/meta slots; `DetailHeader` for resource-detail pages (back link + loading/error states + meta slot for badges/summary); `Breadcrumb` + `BackLink`.
- `components/providers/query-provider.tsx` — see `<Routing_And_Auth>`.
- `lib/api-client.ts` — Hono RPC client (`api`), see `<Routing_And_Auth>`.
  </Component_Vocabulary>

<Hooks>
Two shared hooks own all admin data-fetching. Both wrap TanStack Query — callers never touch `useQuery` directly for list/detail loads.

**`hooks/useListData.ts`** — paginated list fetch with sort/search/filter state.

```ts
export type UseListDataOptions<T, S extends string> = {
  queryKey: readonly unknown[]; // base key — hook appends page/sort/search internally
  queryFn: (args: {
    page: number;
    pageSize: number;
    sortBy: S;
    sortDir: "asc" | "desc";
    search: string;
    signal: AbortSignal;
  }) => Promise<{ items: T[]; total: number }>;
  defaultSortBy: S;
  sortableColumns: readonly S[];
  errorMessage: string;
  pageSize?: number; // default 10
  searchDebounceMs?: number; // default 300
};
```

Internals: `useQuery` with `queryKey: [...opts.queryKey, { page, pageSize, sortBy, sortDir, search }]` + `placeholderData: keepPreviousData` (smooth pagination, no flash). Cancellation handled by Query (signal threaded through). `refresh()` returned to callers calls `queryClient.invalidateQueries({ queryKey: opts.queryKey })`. Caller passes filter values via `queryKey` so changes auto-refetch — caller still owns `useEffect(() => resetPage(), [filterDeps])` to bounce page back to 1.

Do NOT reintroduce `endpoint` + `mapResponse` props — that was the old shape; current shape gives caller full type-safe RPC control inside `queryFn`.

**`hooks/useResource.ts`** — single-record fetch with not-found mapping.

```ts
export const NOT_FOUND_ERROR = "not_found";

export type UseResourceOptions<T> = {
  queryKey: readonly unknown[];
  queryFn: (signal: AbortSignal) => Promise<T>;
  notFoundMessage: string;
  errorMessage: string;
  enabled?: boolean; // default true — set to false to skip (replaces "endpoint: null")
};
```

Internals: `useQuery` with `enabled`, `retry: false` (don't retry 404s). Caller's `queryFn` throws `new Error(NOT_FOUND_ERROR)` on `res.status === 404` and the hook maps it to `notFoundMessage`; any other thrown error maps to `errorMessage`.

**`hooks/useStatusFilter.tsx`** — column-header dropdown filter for status enums. Returns `{ filter: S[], setFilter, hasActive, columnHeader }`. Caller passes `filter` into the list `queryKey` and includes it in the RPC query as `status: filter.join(",")` when non-empty.

**`hooks/useDebouncedValue`** — exported from `useListData.ts`. Wraps a value with `setTimeout`-based debounce (default 300ms). Used for free-text filter inputs that aren't the main `search` (which `useListData` already debounces internally).
</Hooks>

<Page_Patterns>
**Login** (`apps/web/src/app/admin/login/page.tsx`): `"use client"`, react-hook-form + zodResolver, `signIn.email()`, error codes mapped via `Login.serverErrors.<CODE>`, redirect to `/admin/dashboard`.

**Dashboard layout** (`apps/web/src/app/admin/(dashboard)/layout.tsx`): `"use client"`, `useSession()` guard with `router.replace("/admin/login")` when unauthenticated, skeleton during `isPending`, skip-to-content link, sidebar collapse state in `localStorage`, `<main id="main-content" tabIndex={-1}>`.

**List page** (e.g. `apps/web/src/app/admin/(dashboard)/<resource>/page.tsx`): `"use client"`. Use `useListData<Item, SortBy>({ queryKey, queryFn, defaultSortBy, sortableColumns, errorMessage })` — `queryFn` calls `api.api.admin.<resource>.$get({ query: {...} }, { init: { signal, credentials: "include" } })` from `@/lib/api-client`, throws on `!res.ok`, returns `{ items, total }`. Filters belong in `queryKey` so changes auto-refetch; pair with `useEffect(() => list.resetPage(), [...filterDeps])`. Render via `<DataTableCard list={list} columns={...} filters={...} labels={...} />`. Action column rendered with `<StandardRowActions itemName={...} t={tActions} viewHref={...} />`. Do NOT use raw `fetch()`, do NOT manage your own `AbortController`/request-id guard — that's Query's job now.

```tsx
import { api } from "@/lib/api-client";

const status = statusFilter.filter;
const list = useListData<Trunk, VoiceTrunkListSortBy>({
  queryKey: ["voice-trunks", { carrier, ip, status }],
  defaultSortBy: "name",
  sortableColumns: SORTABLE_COLUMNS,
  errorMessage: t("loadError"),
  queryFn: async ({ page, pageSize, sortBy, sortDir, search, signal }) => {
    const res = await api.api.admin["voice-trunks"].$get(
      {
        query: {
          page: String(page),
          pageSize: String(pageSize),
          sortBy,
          sortDir,
          ...(search ? { search } : {}),
          ...(carrier ? { carrier } : {}),
          ...(ip ? { ip } : {}),
          ...(status.length > 0 ? { status: status.join(",") } : {}),
        },
      },
      { init: { signal, credentials: "include" } },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as VoiceTrunkListResponse;
    return { items: json.trunks, total: json.total };
  },
});
```

`api.api.admin.<x>` uses property access; hyphenated path segments need bracket notation: `api.api.admin["voice-trunks"]`. Dynamic params: `api.api.admin["voice-numbering-plans"][":id"].destinations.$get({ param: { id }, query: {...} }, ...)`.

**Locale typing gotcha**: `useLocale()` returns `string`, but RPC routes that accept locale typically have Zod `z.enum(["en","it"])`. Cast at the call-site: `const locale = useLocale() as Locale;` (import `Locale` from `@/i18n/config`).

**Detail page** (e.g. `<resource>/[id]/page.tsx`): combine `useResource<Detail>({ queryKey: ["resource", id], enabled: !!id, queryFn, notFoundMessage, errorMessage })` for the record + `useListData<Child, ChildSortBy>({ queryKey: ["resource-children", id, {locale, prefix}], ... })` for any nested list. Render via `<DetailHeader title={record?.name ?? notFoundLabel} loading={loading} error={error} meta={...} />` + `<DataTableCard ... />`.

**Form modal** (e.g. `components/features/<resource>/<resource>-form-modal.tsx`): `Modal` + RHF + zod from `@<scope>/shared`. For ad-hoc resource fetches inside the modal (e.g. countries dropdown), use `useQuery` directly with the `api` client — gated by `enabled: open`:

```ts
const countriesQuery = useQuery({
  queryKey: ["countries", locale],
  enabled: open,
  queryFn: async ({ signal }) => {
    const res = await api.api.admin.countries.$get(
      { query: { locale } },
      { init: { signal, credentials: "include" } },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as CountryListResponse;
    return json.countries;
  },
});
const countries = countriesQuery.data ?? [];
const countriesLoading = countriesQuery.isPending || countriesQuery.isFetching;
```

For mutations (create/update/delete), use `useMutation` + `queryClient.invalidateQueries({ queryKey: ["<resource>"] })` on success — that triggers the parent list to refetch via the same `queryKey` base.
</Page_Patterns>

<Page_Metadata>
**Next.js 16 dynamic-segment template bug** — workaround required.

Root layout sets `title: { template: "%s · ${appName}", default: appName }`. Template propagates to most child layouts that set plain string `title`. BUT when a `[id]/layout.tsx` sits below an intermediate layout that ALSO sets `title` (e.g. `voice/layout.tsx` for the list + `voice/[id]/layout.tsx` for the detail), Next 16 fails to apply the root template to the detail layout. The browser tab title comes out as `"Voice numbering plan"` instead of `"Voice numbering plan · Audiotext Panel"`.

Fix in detail layouts only — compose `title.absolute` manually:

```ts
export async function generateMetadata(): Promise<Metadata> {
  const [t, tCommon] = await Promise.all([
    getTranslations("PageTitles"),
    getTranslations("Common"),
  ]);
  return {
    title: { absolute: `${t("<detailKey>")} · ${tCommon("appName")}` },
  };
}
```

List/parent layouts keep the simple `{ title: t("<key>") }` shape — root template still applies to those.
</Page_Metadata>

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
- `export type AppType = typeof routes` — consumed by web's `apps/web/src/lib/api-client.ts` via `hc<AppType>("/")`. Every new route MUST be chained onto the same `routes` const (not mounted as a side effect) or its types will not flow into the client.
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
5. **Wire one full vertical**:
   - api: route file using `@hono/zod-openapi` `createRoute` with `requireAuth`, schemas from `@<scope>/shared`, chained onto `routes` const so it flows into `AppType`.
   - shared: Zod schemas (query/list-item/list-response) per `<API_Patterns>`.
   - web: `apps/web/src/lib/api-client.ts` (`hc<AppType>("/")`), `apps/web/src/components/providers/query-provider.tsx` mounted in root layout INSIDE `NextIntlClientProvider`, list page using `useListData({ queryKey, queryFn })` + `<DataTableCard>` + `<StandardRowActions>`, optional create modal using `useMutation` + `queryClient.invalidateQueries`.
   - Detail page (if requested): pair `useResource` + nested `useListData`, render via `<DetailHeader>`. Detail layout uses `title.absolute` per `<Page_Metadata>`.
   Prove the loop works end-to-end before scaffolding more resources.
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
- Write raw `fetch()` in admin pages or components — every API call goes through `api` from `@/lib/api-client` (typed via Hono RPC) wrapped in `useQuery`/`useMutation` (or `useListData`/`useResource`). Manual `AbortController` + `useRef` request-id guards are obsolete; Query handles cancellation.
- Install Tremor (`@tremor/react`) — it requires Tailwind 3 and breaks under Tailwind 4. Use `recharts` directly. If a component vocabulary is wanted, copy from `tremor-raw` (headless), don't pull the v3 package.
- Skip `placeholderData: keepPreviousData` on paginated queries — without it, the table flashes empty between pages.
- Set `title` only as a plain string in a `[id]/layout.tsx` when an intermediate parent layout also sets `title` — the root template won't apply (Next 16 quirk). Use `title.absolute` per `<Page_Metadata>`.
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
- [ ] React Query Devtools floating button visible in dev (bottom-right). Open it — list-page query appears in cache with the expected `queryKey`.
- [ ] Hono RPC types resolve in IDE: hover `api.api.admin.<resource>.$get` → `query` parameter is fully typed (not `Record<string,string>`), response is the actual `{ <items>, total, page, pageSize }` shape (not `unknown`). If types collapse to `unknown`, the route is missing `.openapi(createRoute(...), handler)` with explicit Zod schemas.
- [ ] Detail-page browser tab title contains the `· <appName>` suffix (verifies `title.absolute` workaround applied).
- [ ] Network tab on rapid filter typing shows debounced requests (one per ~300ms pause) and aborted in-flight requests on each new dispatch (proves Query cancellation is working).
- [ ] Pagination clicks don't flash empty rows between pages (proves `placeholderData: keepPreviousData`).
      </Verification_Checklist>
