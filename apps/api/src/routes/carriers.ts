import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { isNull, desc, asc, sql, and, eq, ilike, or, type SQL } from "drizzle-orm";
import { db, carriers, voiceTrunks } from "@audiotext/db";
import {
  CarrierListQuerySchema,
  CarrierListResponseSchema,
} from "@audiotext/shared";
import { requireAuth, type AuthVariables } from "../lib/require-auth";

const listCarriersRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Carriers"],
  summary: "List carriers (paginated, sortable, searchable)",
  middleware: [requireAuth] as const,
  request: {
    query: CarrierListQuerySchema,
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: CarrierListResponseSchema },
      },
      description: "Paginated list of active carriers",
    },
    401: {
      description: "Unauthorized",
    },
  },
});

export const carriersRoutes = new OpenAPIHono<{
  Variables: AuthVariables;
}>().openapi(listCarriersRoute, async (c) => {
  const { page, pageSize, search, sortBy, sortDir } = c.req.valid("query");

  const trunkCountExpr = sql<number>`count(${voiceTrunks.id})::int`;

  const filters: SQL[] = [isNull(carriers.deletedAt)];
  if (search && search.length > 0) {
    const term = `%${search}%`;
    const searchClause = or(
      ilike(carriers.name, term),
      ilike(carriers.businessName, term),
    );
    if (searchClause) filters.push(searchClause);
  }
  const whereClause = and(...filters);

  const orderColumn = (() => {
    switch (sortBy) {
      case "businessName":
        return carriers.businessName;
      case "status":
        return carriers.status;
      case "trunkCount":
        return trunkCountExpr;
      case "createdAt":
        return carriers.createdAt;
      case "name":
      default:
        return carriers.name;
    }
  })();
  const orderBy = sortDir === "asc" ? asc(orderColumn) : desc(orderColumn);

  const offset = (page - 1) * pageSize;

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        id: carriers.id,
        name: carriers.name,
        businessName: carriers.businessName,
        status: carriers.status,
        createdAt: carriers.createdAt,
        updatedAt: carriers.updatedAt,
        trunkCount: trunkCountExpr,
      })
      .from(carriers)
      .leftJoin(
        voiceTrunks,
        and(eq(voiceTrunks.carrierId, carriers.id)),
      )
      .where(whereClause)
      .groupBy(carriers.id)
      .orderBy(orderBy, desc(carriers.id))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(carriers)
      .where(whereClause),
  ]);

  const total = totalRow[0]?.count ?? 0;

  return c.json(
    {
      carriers: rows.map((r) => ({
        id: r.id,
        name: r.name,
        businessName: r.businessName,
        status: r.status,
        trunkCount: r.trunkCount,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    },
    200,
  );
});
