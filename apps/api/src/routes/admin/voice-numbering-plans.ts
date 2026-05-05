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
  voiceNumberingPlans,
  voiceNumberingPlanDestinations,
  voiceNumberingPlanCodes,
} from "@audiotext/db";
import {
  VoiceNumberingPlanDestinationListQuerySchema,
  VoiceNumberingPlanDestinationListResponseSchema,
  VoiceNumberingPlanDetailSchema,
  VoiceNumberingPlanListResponseSchema,
} from "@audiotext/shared";
import { requireAuth, type AuthVariables } from "../../lib/require-auth";

const listVoiceNumberingPlansRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["VoiceNumberingPlans"],
  summary: "List voice numbering plans with destination + code counts",
  middleware: [requireAuth] as const,
  responses: {
    200: {
      content: {
        "application/json": { schema: VoiceNumberingPlanListResponseSchema },
      },
      description: "List of active voice numbering plans",
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
      .where(isNull(voiceNumberingPlans.deletedAt))
      .groupBy(voiceNumberingPlans.id)
      .orderBy(desc(voiceNumberingPlans.createdAt));

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
    const { page, pageSize, search, sortBy, sortDir } = c.req.valid("query");

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
    const countryCodeExpr = sql<string | null>`(array_agg(${voiceNumberingPlanCodes.countryCode}) filter (where ${voiceNumberingPlanCodes.id} is not null))[1]`;
    const destinationCodesExpr = sql<
      string[]
    >`coalesce(array_remove(array_agg(${voiceNumberingPlanCodes.destinationCode}), null), '{}')::text[]`;

    const filters: SQL[] = [
      eq(voiceNumberingPlanDestinations.voiceNumberingPlanId, id),
      isNull(voiceNumberingPlanDestinations.deletedAt),
    ];
    if (search && search.length > 0) {
      const term = `%${search}%`;
      const searchClause = or(
        ilike(voiceNumberingPlanDestinations.name, term),
        ilike(voiceNumberingPlanDestinations.countryIso2, term),
      );
      if (searchClause) filters.push(searchClause);
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
        default:
          return voiceNumberingPlanDestinations.countryIso2;
      }
    })();
    const orderBy = sortDir === "asc" ? asc(orderColumn) : desc(orderColumn);

    const offset = (page - 1) * pageSize;

    const [rows, totalRow] = await Promise.all([
      db
        .select({
          id: voiceNumberingPlanDestinations.id,
          countryIso2: voiceNumberingPlanDestinations.countryIso2,
          name: voiceNumberingPlanDestinations.name,
          type: voiceNumberingPlanDestinations.type,
          countryCode: countryCodeExpr,
          destinationCodes: destinationCodesExpr,
          codeCount: codeCountExpr,
          website: voiceNumberingPlanDestinations.website,
        })
        .from(voiceNumberingPlanDestinations)
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
        .groupBy(voiceNumberingPlanDestinations.id)
        .orderBy(orderBy, desc(voiceNumberingPlanDestinations.id))
        .limit(pageSize)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(voiceNumberingPlanDestinations)
        .where(whereClause),
    ]);

    const total = totalRow[0]?.count ?? 0;

    return c.json(
      {
        destinations: rows.map((r) => ({
          id: r.id,
          countryIso2: r.countryIso2,
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
