import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
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
  carriers,
  voiceTrunks,
  voiceTrunkIps,
  voiceRateSheets,
} from "@audiotext/db";
import {
  VoiceTrunkListQuerySchema,
  VoiceTrunkListResponseSchema,
} from "@audiotext/shared";
import { requireAuth, type AuthVariables } from "../../lib/require-auth";

const listVoiceTrunksRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["VoiceTrunks"],
  summary: "List voice trunks (paginated, sortable, searchable)",
  middleware: [requireAuth] as const,
  request: {
    query: VoiceTrunkListQuerySchema,
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: VoiceTrunkListResponseSchema },
      },
      description: "Paginated list of active voice trunks",
    },
    401: { description: "Unauthorized" },
  },
});

export const voiceTrunksRoutes = new OpenAPIHono<{
  Variables: AuthVariables;
}>().openapi(listVoiceTrunksRoute, async (c) => {
  const { page, pageSize, search, carrier, ip, sortBy, sortDir } =
    c.req.valid("query");

  const carrierJoinCondition = and(
    eq(carriers.id, voiceTrunks.carrierId),
    isNull(carriers.deletedAt),
  );
  const rateSheetJoinCondition = and(
    eq(voiceRateSheets.id, voiceTrunks.voiceRateSheetId),
    isNull(voiceRateSheets.deletedAt),
  );

  const filters: SQL[] = [isNull(voiceTrunks.deletedAt)];
  if (search && search.length > 0) {
    const term = `%${search}%`;
    const searchClause = or(
      ilike(voiceTrunks.name, term),
      ilike(carriers.name, term),
      ilike(voiceRateSheets.name, term),
    );
    if (searchClause) filters.push(searchClause);
  }
  if (carrier && carrier.length > 0) {
    const term = `%${carrier}%`;
    const carrierClause = or(
      ilike(carriers.name, term),
      ilike(carriers.businessName, term),
    );
    if (carrierClause) filters.push(carrierClause);
  }
  if (ip && ip.length > 0) {
    const term = `${ip}%`;
    filters.push(sql`EXISTS (
      SELECT 1 FROM ${voiceTrunkIps}
      WHERE ${voiceTrunkIps.voiceTrunkId} = ${voiceTrunks.id}
        AND ${voiceTrunkIps.deletedAt} IS NULL
        AND ${voiceTrunkIps.ip} ILIKE ${term}
    )`);
  }
  const whereClause = and(...filters);

  const orderColumn = (() => {
    switch (sortBy) {
      case "carrierName":
        return carriers.name;
      case "voiceRateSheetName":
        return voiceRateSheets.name;
      case "status":
        return voiceTrunks.status;
      case "createdAt":
        return voiceTrunks.createdAt;
      case "name":
      default:
        return voiceTrunks.name;
    }
  })();
  const orderBy = sortDir === "asc" ? asc(orderColumn) : desc(orderColumn);

  const offset = (page - 1) * pageSize;

  const ipCountSql = sql<number>`(
    SELECT count(*)::int FROM ${voiceTrunkIps}
    WHERE ${voiceTrunkIps.voiceTrunkId} = ${voiceTrunks.id}
      AND ${voiceTrunkIps.deletedAt} IS NULL
  )`;

  const ipsSql = sql<string[]>`(
    SELECT COALESCE(array_agg(${voiceTrunkIps.ip} ORDER BY ${voiceTrunkIps.ip}), ARRAY[]::text[])
    FROM ${voiceTrunkIps}
    WHERE ${voiceTrunkIps.voiceTrunkId} = ${voiceTrunks.id}
      AND ${voiceTrunkIps.deletedAt} IS NULL
  )`;

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        id: voiceTrunks.id,
        name: voiceTrunks.name,
        status: voiceTrunks.status,
        carrierId: voiceTrunks.carrierId,
        carrierName: carriers.name,
        voiceRateSheetId: voiceTrunks.voiceRateSheetId,
        voiceRateSheetName: voiceRateSheets.name,
        ipCount: ipCountSql,
        ips: ipsSql,
        createdAt: voiceTrunks.createdAt,
        updatedAt: voiceTrunks.updatedAt,
      })
      .from(voiceTrunks)
      .innerJoin(carriers, carrierJoinCondition)
      .leftJoin(voiceRateSheets, rateSheetJoinCondition)
      .where(whereClause)
      .orderBy(orderBy, desc(voiceTrunks.id))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(voiceTrunks)
      .innerJoin(carriers, carrierJoinCondition)
      .leftJoin(voiceRateSheets, rateSheetJoinCondition)
      .where(whereClause),
  ]);

  const total = totalRow[0]?.count ?? 0;

  return c.json(
    {
      trunks: rows.map((r) => ({
        id: r.id,
        name: r.name,
        status: r.status,
        carrierId: r.carrierId,
        carrierName: r.carrierName,
        voiceRateSheetId: r.voiceRateSheetId,
        voiceRateSheetName: r.voiceRateSheetName,
        ipCount: r.ipCount ?? 0,
        ips: r.ips ?? [],
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
