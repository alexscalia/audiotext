import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import {
  isNull,
  desc,
  asc,
  sql,
  and,
  eq,
  ilike,
  or,
  type SQL,
} from "drizzle-orm";
import {
  db,
  countries,
  voiceNumberingPlans,
  voiceNumberingPlanDestinations,
  voiceNumberingPlanCodes,
} from "@audiotext/db";
import {
  VoiceNumberingPlanDestinationListQuerySchema,
  VoiceNumberingPlanDestinationListResponseSchema,
  VoiceNumberingPlanDetailSchema,
  VoiceNumberingPlanListQuerySchema,
  VoiceNumberingPlanListResponseSchema,
} from "@audiotext/shared";
import { requireAuth, type AuthVariables } from "../../lib/require-auth";

const listVoiceNumberingPlansRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["VoiceNumberingPlans"],
  summary:
    "List voice numbering plans (paginated, sortable, searchable) with destination + code counts",
  middleware: [requireAuth] as const,
  request: {
    query: VoiceNumberingPlanListQuerySchema,
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: VoiceNumberingPlanListResponseSchema },
      },
      description: "Paginated list of active voice numbering plans",
    },
    401: {
      description: "Unauthorized",
    },
  },
});

const planIdParams = z.object({
  id: z.string().uuid(),
});

const detailRoute = createRoute({
  method: "get",
  path: "/{id}",
  tags: ["VoiceNumberingPlans"],
  summary: "Get a single voice numbering plan with counts",
  middleware: [requireAuth] as const,
  request: {
    params: planIdParams,
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: VoiceNumberingPlanDetailSchema },
      },
      description: "Plan summary",
    },
    401: { description: "Unauthorized" },
    404: { description: "Plan not found" },
  },
});

const destinationsRoute = createRoute({
  method: "get",
  path: "/{id}/destinations",
  tags: ["VoiceNumberingPlans"],
  summary:
    "List a plan's destinations (paginated, sortable, searchable) with aggregated codes",
  middleware: [requireAuth] as const,
  request: {
    params: planIdParams,
    query: VoiceNumberingPlanDestinationListQuerySchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: VoiceNumberingPlanDestinationListResponseSchema,
        },
      },
      description: "Paginated destinations for the plan",
    },
    401: { description: "Unauthorized" },
    404: { description: "Plan not found" },
  },
});

export const voiceNumberingPlansRoutes = new OpenAPIHono<{
  Variables: AuthVariables;
}>()
  .openapi(listVoiceNumberingPlansRoute, async (c) => {
    const { page, pageSize, search, sortBy, sortDir } = c.req.valid("query");

    const destinationCountExpr = sql<number>`count(distinct ${voiceNumberingPlanDestinations.id})::int`;
    const codeCountExpr = sql<number>`count(${voiceNumberingPlanCodes.id})::int`;

    const filters: SQL[] = [isNull(voiceNumberingPlans.deletedAt)];
    if (search && search.length > 0) {
      const term = `%${search}%`;
      const searchClause = ilike(voiceNumberingPlans.name, term);
      if (searchClause) filters.push(searchClause);
    }
    const whereClause = and(...filters);

    const orderColumn = (() => {
      switch (sortBy) {
        case "status":
          return voiceNumberingPlans.status;
        case "destinationCount":
          return destinationCountExpr;
        case "codeCount":
          return codeCountExpr;
        case "createdAt":
          return voiceNumberingPlans.createdAt;
        case "name":
        default:
          return voiceNumberingPlans.name;
      }
    })();
    const orderBy = sortDir === "asc" ? asc(orderColumn) : desc(orderColumn);

    const offset = (page - 1) * pageSize;

    const [rows, totalRow] = await Promise.all([
      db
        .select({
          id: voiceNumberingPlans.id,
          name: voiceNumberingPlans.name,
          status: voiceNumberingPlans.status,
          createdAt: voiceNumberingPlans.createdAt,
          updatedAt: voiceNumberingPlans.updatedAt,
          destinationCount: destinationCountExpr,
          codeCount: codeCountExpr,
        })
        .from(voiceNumberingPlans)
        .leftJoin(
          voiceNumberingPlanDestinations,
          and(
            eq(
              voiceNumberingPlanDestinations.voiceNumberingPlanId,
              voiceNumberingPlans.id,
            ),
            isNull(voiceNumberingPlanDestinations.deletedAt),
          ),
        )
        .leftJoin(
          voiceNumberingPlanCodes,
          and(
            eq(
              voiceNumberingPlanCodes.voiceNumberingPlanDestinationId,
              voiceNumberingPlanDestinations.id,
            ),
            isNull(voiceNumberingPlanCodes.deletedAt),
          ),
        )
        .where(whereClause)
        .groupBy(voiceNumberingPlans.id)
        .orderBy(orderBy, desc(voiceNumberingPlans.id))
        .limit(pageSize)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(voiceNumberingPlans)
        .where(whereClause),
    ]);

    const total = totalRow[0]?.count ?? 0;

    return c.json(
      {
        plans: rows.map((r) => ({
          id: r.id,
          name: r.name,
          status: r.status,
          destinationCount: r.destinationCount,
          codeCount: r.codeCount,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        })),
        total,
        page,
        pageSize,
      },
      200,
    );
  })
  .openapi(detailRoute, async (c) => {
    const { id } = c.req.valid("param");

    const rows = await db
      .select({
        id: voiceNumberingPlans.id,
        name: voiceNumberingPlans.name,
        status: voiceNumberingPlans.status,
        createdAt: voiceNumberingPlans.createdAt,
        updatedAt: voiceNumberingPlans.updatedAt,
        destinationCount: sql<number>`count(distinct ${voiceNumberingPlanDestinations.id})::int`,
        codeCount: sql<number>`count(${voiceNumberingPlanCodes.id})::int`,
      })
      .from(voiceNumberingPlans)
      .leftJoin(
        voiceNumberingPlanDestinations,
        and(
          eq(
            voiceNumberingPlanDestinations.voiceNumberingPlanId,
            voiceNumberingPlans.id,
          ),
          isNull(voiceNumberingPlanDestinations.deletedAt),
        ),
      )
      .leftJoin(
        voiceNumberingPlanCodes,
        and(
          eq(
            voiceNumberingPlanCodes.voiceNumberingPlanDestinationId,
            voiceNumberingPlanDestinations.id,
          ),
          isNull(voiceNumberingPlanCodes.deletedAt),
        ),
      )
      .where(
        and(
          eq(voiceNumberingPlans.id, id),
          isNull(voiceNumberingPlans.deletedAt),
        ),
      )
      .groupBy(voiceNumberingPlans.id);

    const row = rows[0];
    if (!row) {
      return c.json({ error: "not_found" }, 404);
    }

    return c.json(
      {
        id: row.id,
        name: row.name,
        status: row.status,
        destinationCount: row.destinationCount,
        codeCount: row.codeCount,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      },
      200,
    );
  })
  .openapi(destinationsRoute, async (c) => {
    const { id } = c.req.valid("param");
    const { page, pageSize, search, prefix, sortBy, sortDir, locale } =
      c.req.valid("query");

    const planExists = await db
      .select({ id: voiceNumberingPlans.id })
      .from(voiceNumberingPlans)
      .where(
        and(
          eq(voiceNumberingPlans.id, id),
          isNull(voiceNumberingPlans.deletedAt),
        ),
      )
      .limit(1);

    if (!planExists[0]) {
      return c.json({ error: "not_found" }, 404);
    }

    const codeCountExpr = sql<number>`count(${voiceNumberingPlanCodes.id})::int`;
    const countryCodeExpr = sql<
      string | null
    >`(array_agg(${voiceNumberingPlanCodes.countryCode}) filter (where ${voiceNumberingPlanCodes.id} is not null))[1]`;
    const destinationCodesExpr = sql<
      string[]
    >`coalesce(array_remove(array_agg(${voiceNumberingPlanCodes.destinationCode}), null), '{}')::text[]`;
    const countryNameCol =
      locale === "it" ? countries.nameIt : countries.nameEn;
    const countryNameExpr = sql<string>`coalesce(${countryNameCol}, ${voiceNumberingPlanDestinations.countryIso2})`;
    const typePriorityExpr = sql<number>`case ${voiceNumberingPlanDestinations.type}
      when 'all' then 1
      when 'landline' then 2
      when 'mobile' then 3
      when 'premium' then 4
      when 'special' then 5
      when 'toll_free' then 6
      when 'shared_cost' then 7
      when 'satellite' then 8
      when 'personal' then 9
      when 'paging' then 10
      when 'voip' then 11
      when 'ngn' then 12
      else 99
    end`;

    const filters: SQL[] = [
      eq(voiceNumberingPlanDestinations.voiceNumberingPlanId, id),
      isNull(voiceNumberingPlanDestinations.deletedAt),
    ];
    if (search && search.length > 0) {
      const term = `%${search}%`;
      const searchClause = or(
        ilike(voiceNumberingPlanDestinations.name, term),
        ilike(voiceNumberingPlanDestinations.countryIso2, term),
        ilike(countryNameCol, term),
      );
      if (searchClause) filters.push(searchClause);
    }
    if (prefix && prefix.length > 0) {
      filters.push(
        sql`${voiceNumberingPlanDestinations.id} = (
          SELECT vnpc.voice_numbering_plan_destination_id
          FROM voice_numbering_plan_codes vnpc
          INNER JOIN voice_numbering_plan_destinations vnpd
            ON vnpd.id = vnpc.voice_numbering_plan_destination_id
          WHERE vnpd.voice_numbering_plan_id = ${id}
            AND vnpc.deleted_at IS NULL
            AND vnpd.deleted_at IS NULL
            AND ${prefix} LIKE vnpc.full_code || '%'
          ORDER BY length(vnpc.full_code) DESC
          LIMIT 1
        )`,
      );
    }
    const whereClause = and(...filters);

    const orderColumn = (() => {
      switch (sortBy) {
        case "name":
          return voiceNumberingPlanDestinations.name;
        case "type":
          return voiceNumberingPlanDestinations.type;
        case "codeCount":
          return codeCountExpr;
        case "countryIso2":
          return voiceNumberingPlanDestinations.countryIso2;
        case "countryName":
        default:
          return countryNameExpr;
      }
    })();
    const orderBy = sortDir === "asc" ? asc(orderColumn) : desc(orderColumn);
    const isCountrySort = sortBy === "countryName" || sortBy === "countryIso2";
    const tieBreakers = isCountrySort
      ? [asc(typePriorityExpr), asc(voiceNumberingPlanDestinations.name)]
      : [desc(voiceNumberingPlanDestinations.id)];

    const offset = (page - 1) * pageSize;

    const countriesJoinCondition = and(
      eq(countries.iso2, voiceNumberingPlanDestinations.countryIso2),
      isNull(countries.deletedAt),
    );

    const [rows, totalRow] = await Promise.all([
      db
        .select({
          id: voiceNumberingPlanDestinations.id,
          countryIso2: voiceNumberingPlanDestinations.countryIso2,
          countryName: countryNameExpr,
          name: voiceNumberingPlanDestinations.name,
          type: voiceNumberingPlanDestinations.type,
          countryCode: countryCodeExpr,
          destinationCodes: destinationCodesExpr,
          codeCount: codeCountExpr,
          website: voiceNumberingPlanDestinations.website,
        })
        .from(voiceNumberingPlanDestinations)
        .leftJoin(countries, countriesJoinCondition)
        .leftJoin(
          voiceNumberingPlanCodes,
          and(
            eq(
              voiceNumberingPlanCodes.voiceNumberingPlanDestinationId,
              voiceNumberingPlanDestinations.id,
            ),
            isNull(voiceNumberingPlanCodes.deletedAt),
          ),
        )
        .where(whereClause)
        .groupBy(voiceNumberingPlanDestinations.id, countries.id)
        .orderBy(orderBy, ...tieBreakers)
        .limit(pageSize)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(voiceNumberingPlanDestinations)
        .leftJoin(countries, countriesJoinCondition)
        .where(whereClause),
    ]);

    const total = totalRow[0]?.count ?? 0;

    return c.json(
      {
        destinations: rows.map((r) => ({
          id: r.id,
          countryIso2: r.countryIso2,
          countryName: r.countryName,
          name: r.name,
          type: r.type,
          countryCode: r.countryCode,
          destinationCodes: r.destinationCodes,
          codeCount: r.codeCount,
          website: r.website,
        })),
        total,
        page,
        pageSize,
      },
      200,
    );
  });
