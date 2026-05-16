import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import {
  isNull,
  desc,
  asc,
  sql,
  and,
  eq,
  ilike,
  inArray,
  or,
  type SQL,
} from "drizzle-orm";
import {
  db,
  countries,
  voiceRateSheets,
  voiceRateSheetLines,
  voiceNumberingPlans,
  voiceNumberingPlanDestinations,
  voiceNumberingPlanCodes,
} from "@audiotext/db";
import {
  VoiceRateSheetDetailSchema,
  VoiceRateSheetLineListQuerySchema,
  VoiceRateSheetLineListResponseSchema,
  VoiceRateSheetListQuerySchema,
  VoiceRateSheetListResponseSchema,
} from "@audiotext/shared";
import { requireAuth, type AuthVariables } from "../../lib/require-auth";

const listVoiceRateSheetsRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["VoiceRateSheets"],
  summary:
    "List voice rate sheets (paginated, sortable, searchable) with associated numbering plan name",
  middleware: [requireAuth] as const,
  request: {
    query: VoiceRateSheetListQuerySchema,
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: VoiceRateSheetListResponseSchema },
      },
      description: "Paginated list of active voice rate sheets",
    },
    401: { description: "Unauthorized" },
  },
});

const sheetIdParams = z.object({
  id: z.string().uuid(),
});

const detailRoute = createRoute({
  method: "get",
  path: "/{id}",
  tags: ["VoiceRateSheets"],
  summary: "Get a single voice rate sheet with line count and plan name",
  middleware: [requireAuth] as const,
  request: { params: sheetIdParams },
  responses: {
    200: {
      content: {
        "application/json": { schema: VoiceRateSheetDetailSchema },
      },
      description: "Rate sheet detail",
    },
    401: { description: "Unauthorized" },
    404: { description: "Rate sheet not found" },
  },
});

const linesRoute = createRoute({
  method: "get",
  path: "/{id}/lines",
  tags: ["VoiceRateSheets"],
  summary:
    "List a rate sheet's lines (paginated, sortable, searchable) with aggregated destination codes",
  middleware: [requireAuth] as const,
  request: {
    params: sheetIdParams,
    query: VoiceRateSheetLineListQuerySchema,
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: VoiceRateSheetLineListResponseSchema },
      },
      description: "Paginated rate sheet lines",
    },
    401: { description: "Unauthorized" },
    404: { description: "Rate sheet not found" },
  },
});

export const voiceRateSheetsRoutes = new OpenAPIHono<{
  Variables: AuthVariables;
}>()
  .openapi(listVoiceRateSheetsRoute, async (c) => {
    const { page, pageSize, search, status, sortBy, sortDir } =
      c.req.valid("query");

    const filters: SQL[] = [isNull(voiceRateSheets.deletedAt)];
    if (search && search.length > 0) {
      const term = `%${search}%`;
      const searchClause = or(
        ilike(voiceRateSheets.name, term),
        ilike(voiceNumberingPlans.name, term),
        ilike(voiceRateSheets.currency, term),
      );
      if (searchClause) filters.push(searchClause);
    }
    if (status.length > 0) {
      filters.push(inArray(voiceRateSheets.status, status));
    }
    const whereClause = and(...filters);

    const orderColumn = (() => {
      switch (sortBy) {
        case "voiceNumberingPlanName":
          return voiceNumberingPlans.name;
        case "currency":
          return voiceRateSheets.currency;
        case "createdAt":
          return voiceRateSheets.createdAt;
        case "name":
        default:
          return voiceRateSheets.name;
      }
    })();
    const orderBy = sortDir === "asc" ? asc(orderColumn) : desc(orderColumn);

    const offset = (page - 1) * pageSize;

    const planJoinCondition = and(
      eq(voiceNumberingPlans.id, voiceRateSheets.voiceNumberingPlanId),
      isNull(voiceNumberingPlans.deletedAt),
    );

    const [rows, totalRow] = await Promise.all([
      db
        .select({
          id: voiceRateSheets.id,
          name: voiceRateSheets.name,
          status: voiceRateSheets.status,
          voiceNumberingPlanId: voiceRateSheets.voiceNumberingPlanId,
          voiceNumberingPlanName: voiceNumberingPlans.name,
          currency: voiceRateSheets.currency,
          createdAt: voiceRateSheets.createdAt,
          updatedAt: voiceRateSheets.updatedAt,
        })
        .from(voiceRateSheets)
        .innerJoin(voiceNumberingPlans, planJoinCondition)
        .where(whereClause)
        .orderBy(orderBy, desc(voiceRateSheets.id))
        .limit(pageSize)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(voiceRateSheets)
        .innerJoin(voiceNumberingPlans, planJoinCondition)
        .where(whereClause),
    ]);

    const total = totalRow[0]?.count ?? 0;

    return c.json(
      {
        rateSheets: rows.map((r) => ({
          id: r.id,
          name: r.name,
          status: r.status,
          voiceNumberingPlanId: r.voiceNumberingPlanId,
          voiceNumberingPlanName: r.voiceNumberingPlanName,
          currency: r.currency,
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
        id: voiceRateSheets.id,
        name: voiceRateSheets.name,
        status: voiceRateSheets.status,
        voiceNumberingPlanId: voiceRateSheets.voiceNumberingPlanId,
        voiceNumberingPlanName: voiceNumberingPlans.name,
        currency: voiceRateSheets.currency,
        lineCount: sql<number>`count(${voiceRateSheetLines.id})::int`,
        createdAt: voiceRateSheets.createdAt,
        updatedAt: voiceRateSheets.updatedAt,
      })
      .from(voiceRateSheets)
      .innerJoin(
        voiceNumberingPlans,
        and(
          eq(voiceNumberingPlans.id, voiceRateSheets.voiceNumberingPlanId),
          isNull(voiceNumberingPlans.deletedAt),
        ),
      )
      .leftJoin(
        voiceRateSheetLines,
        and(
          eq(voiceRateSheetLines.voiceRateSheetId, voiceRateSheets.id),
          isNull(voiceRateSheetLines.deletedAt),
        ),
      )
      .where(
        and(
          eq(voiceRateSheets.id, id),
          isNull(voiceRateSheets.deletedAt),
        ),
      )
      .groupBy(voiceRateSheets.id, voiceNumberingPlans.id);

    const row = rows[0];
    if (!row) {
      return c.json({ error: "not_found" }, 404);
    }

    return c.json(
      {
        id: row.id,
        name: row.name,
        status: row.status,
        voiceNumberingPlanId: row.voiceNumberingPlanId,
        voiceNumberingPlanName: row.voiceNumberingPlanName,
        currency: row.currency,
        lineCount: row.lineCount,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      },
      200,
    );
  })
  .openapi(linesRoute, async (c) => {
    const { id } = c.req.valid("param");
    const { page, pageSize, search, prefix, sortBy, sortDir, locale } =
      c.req.valid("query");

    const sheetExists = await db
      .select({ id: voiceRateSheets.id })
      .from(voiceRateSheets)
      .where(
        and(
          eq(voiceRateSheets.id, id),
          isNull(voiceRateSheets.deletedAt),
        ),
      )
      .limit(1);

    if (!sheetExists[0]) {
      return c.json({ error: "not_found" }, 404);
    }

    const codeCountExpr = sql<number>`count(${voiceNumberingPlanCodes.id})::int`;
    const countryCodeExpr = sql<string | null>`(
      SELECT c.country_code
      FROM voice_numbering_plan_codes c
      INNER JOIN voice_numbering_plan_destinations d2 ON d2.id = c.voice_numbering_plan_destination_id
      WHERE d2.voice_numbering_plan_id = ${voiceNumberingPlanDestinations.voiceNumberingPlanId}
        AND d2.country_iso2 = ${voiceNumberingPlanDestinations.countryIso2}
        AND c.deleted_at IS NULL
        AND d2.deleted_at IS NULL
      LIMIT 1
    )`;
    const destinationCodesExpr = sql<
      string[]
    >`coalesce(array_remove(array_agg(${voiceNumberingPlanCodes.destinationCode}), null), '{}')::text[]`;
    const countryNameCol =
      locale === "it" ? countries.nameIt : countries.nameEn;
    const countryNameExpr = sql<string>`coalesce(${countryNameCol}, ${voiceNumberingPlanDestinations.countryIso2})`;

    const filters: SQL[] = [
      eq(voiceRateSheetLines.voiceRateSheetId, id),
      isNull(voiceRateSheetLines.deletedAt),
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
          INNER JOIN voice_rate_sheet_lines vrsl
            ON vrsl.voice_numbering_plan_destination_id = vnpd.id
          WHERE vrsl.voice_rate_sheet_id = ${id}
            AND vnpc.deleted_at IS NULL
            AND vnpd.deleted_at IS NULL
            AND vrsl.deleted_at IS NULL
            AND ${prefix} LIKE vnpc.full_code || '%'
          ORDER BY length(vnpc.full_code) DESC
          LIMIT 1
        )`,
      );
    }
    const whereClause = and(...filters);

    const orderColumn = (() => {
      switch (sortBy) {
        case "destinationName":
          return voiceNumberingPlanDestinations.name;
        case "ratePerMinute":
          return voiceRateSheetLines.ratePerMinute;
        case "setupFee":
          return voiceRateSheetLines.setupFee;
        case "validFrom":
          return voiceRateSheetLines.validFrom;
        case "validTo":
          return voiceRateSheetLines.validTo;
        case "codeCount":
          return codeCountExpr;
        case "countryName":
        default:
          return countryNameExpr;
      }
    })();
    const orderBy = sortDir === "asc" ? asc(orderColumn) : desc(orderColumn);
    const tieBreakers = [
      asc(voiceNumberingPlanDestinations.name),
      desc(voiceRateSheetLines.id),
    ];

    const offset = (page - 1) * pageSize;

    const countriesJoinCondition = and(
      eq(countries.iso2, voiceNumberingPlanDestinations.countryIso2),
      isNull(countries.deletedAt),
    );

    const [rows, totalRow] = await Promise.all([
      db
        .select({
          id: voiceRateSheetLines.id,
          destinationId: voiceNumberingPlanDestinations.id,
          countryIso2: voiceNumberingPlanDestinations.countryIso2,
          countryName: countryNameExpr,
          destinationName: voiceNumberingPlanDestinations.name,
          minDurationSeconds: voiceRateSheetLines.minDurationSeconds,
          incrementSeconds: voiceRateSheetLines.incrementSeconds,
          setupFee: voiceRateSheetLines.setupFee,
          ratePerMinute: voiceRateSheetLines.ratePerMinute,
          validFrom: voiceRateSheetLines.validFrom,
          validTo: voiceRateSheetLines.validTo,
          countryCode: countryCodeExpr,
          destinationCodes: destinationCodesExpr,
          codeCount: codeCountExpr,
        })
        .from(voiceRateSheetLines)
        .innerJoin(
          voiceNumberingPlanDestinations,
          eq(
            voiceNumberingPlanDestinations.id,
            voiceRateSheetLines.voiceNumberingPlanDestinationId,
          ),
        )
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
        .groupBy(
          voiceRateSheetLines.id,
          voiceNumberingPlanDestinations.id,
          countries.id,
        )
        .orderBy(orderBy, ...tieBreakers)
        .limit(pageSize)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(voiceRateSheetLines)
        .innerJoin(
          voiceNumberingPlanDestinations,
          eq(
            voiceNumberingPlanDestinations.id,
            voiceRateSheetLines.voiceNumberingPlanDestinationId,
          ),
        )
        .leftJoin(countries, countriesJoinCondition)
        .where(whereClause),
    ]);

    const total = totalRow[0]?.count ?? 0;

    return c.json(
      {
        lines: rows.map((r) => ({
          id: r.id,
          destinationId: r.destinationId,
          countryIso2: r.countryIso2,
          countryName: r.countryName,
          destinationName: r.destinationName,
          minDurationSeconds: r.minDurationSeconds,
          incrementSeconds: r.incrementSeconds,
          setupFee: r.setupFee,
          ratePerMinute: r.ratePerMinute,
          validFrom: r.validFrom.toISOString(),
          validTo: r.validTo ? r.validTo.toISOString() : null,
          countryCode: r.countryCode,
          destinationCodes: r.destinationCodes,
          codeCount: r.codeCount,
        })),
        total,
        page,
        pageSize,
      },
      200,
    );
  });
