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
  carriers,
  voiceTrunks,
  voiceTrunkIps,
  voiceRateSheets,
} from "@audiotext/db";
import {
  VoiceTrunkListQuerySchema,
  VoiceTrunkListResponseSchema,
  VoiceTrunkIpSchema,
  VoiceTrunkIpListResponseSchema,
  VoiceTrunkIpConflictResponseSchema,
  CreateVoiceTrunkIpInput,
  CreateVoiceTrunkIpResponseSchema,
  UpdateVoiceTrunkIpInput,
  UpdateVoiceTrunkIpRangeInput,
  DeleteVoiceTrunkIpRangeInput,
  VoiceTrunkIpRangeMutationResultSchema,
} from "@audiotext/shared";
import { requireAuth, type AuthVariables } from "../../lib/require-auth";
import { publishLcrReload } from "../../lib/lcr-reload";
import { CidrError, expandCidr } from "../../lib/cidr";

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

const trunkIdParam = z.object({ id: z.string().uuid() });
const trunkIpParams = z.object({
  id: z.string().uuid(),
  ipId: z.string().uuid(),
});

const listTrunkIpsRoute = createRoute({
  method: "get",
  path: "/{id}/ips",
  tags: ["VoiceTrunks"],
  summary: "List active IPs for a voice trunk",
  middleware: [requireAuth] as const,
  request: { params: trunkIdParam },
  responses: {
    200: {
      content: {
        "application/json": { schema: VoiceTrunkIpListResponseSchema },
      },
      description: "IPs for the trunk",
    },
    401: { description: "Unauthorized" },
    404: { description: "Trunk not found" },
  },
});

const createTrunkIpRoute = createRoute({
  method: "post",
  path: "/{id}/ips",
  tags: ["VoiceTrunks"],
  summary: "Add an IP or CIDR-expanded range to a voice trunk",
  middleware: [requireAuth] as const,
  request: {
    params: trunkIdParam,
    body: {
      content: {
        "application/json": { schema: CreateVoiceTrunkIpInput },
      },
    },
  },
  responses: {
    201: {
      content: {
        "application/json": { schema: CreateVoiceTrunkIpResponseSchema },
      },
      description: "Created (single row, or CIDR batch summary)",
    },
    401: { description: "Unauthorized" },
    404: { description: "Trunk not found" },
    409: {
      content: {
        "application/json": { schema: VoiceTrunkIpConflictResponseSchema },
      },
      description: "Conflict (duplicate, carrier mismatch, or CIDR cap)",
    },
    422: {
      content: {
        "application/json": { schema: VoiceTrunkIpConflictResponseSchema },
      },
      description: "Invalid or too-large CIDR",
    },
  },
});

const updateTrunkIpRangeRoute = createRoute({
  method: "patch",
  path: "/{id}/ips/range",
  tags: ["VoiceTrunks"],
  summary: "Bulk-update all members of a CIDR-expanded range",
  middleware: [requireAuth] as const,
  request: {
    params: trunkIdParam,
    body: {
      content: {
        "application/json": { schema: UpdateVoiceTrunkIpRangeInput },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: VoiceTrunkIpRangeMutationResultSchema },
      },
      description: "Updated row count",
    },
    400: { description: "No changes" },
    401: { description: "Unauthorized" },
    404: { description: "Trunk or range not found" },
  },
});

const deleteTrunkIpRangeRoute = createRoute({
  method: "delete",
  path: "/{id}/ips/range",
  tags: ["VoiceTrunks"],
  summary: "Soft-delete all members of a CIDR-expanded range",
  middleware: [requireAuth] as const,
  request: {
    params: trunkIdParam,
    body: {
      content: {
        "application/json": { schema: DeleteVoiceTrunkIpRangeInput },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: VoiceTrunkIpRangeMutationResultSchema },
      },
      description: "Deleted row count",
    },
    401: { description: "Unauthorized" },
    404: { description: "Trunk or range not found" },
  },
});

const updateTrunkIpRoute = createRoute({
  method: "patch",
  path: "/{id}/ips/{ipId}",
  tags: ["VoiceTrunks"],
  summary: "Update prefix or status of a trunk IP",
  middleware: [requireAuth] as const,
  request: {
    params: trunkIpParams,
    body: {
      content: {
        "application/json": { schema: UpdateVoiceTrunkIpInput },
      },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: VoiceTrunkIpSchema } },
      description: "Updated",
    },
    400: { description: "No changes" },
    401: { description: "Unauthorized" },
    404: { description: "Trunk or IP not found" },
    409: {
      content: {
        "application/json": { schema: VoiceTrunkIpConflictResponseSchema },
      },
      description: "Conflict",
    },
  },
});

const deleteTrunkIpRoute = createRoute({
  method: "delete",
  path: "/{id}/ips/{ipId}",
  tags: ["VoiceTrunks"],
  summary: "Soft-delete a trunk IP",
  middleware: [requireAuth] as const,
  request: { params: trunkIpParams },
  responses: {
    204: { description: "Deleted" },
    401: { description: "Unauthorized" },
    404: { description: "Trunk or IP not found" },
  },
});

export const voiceTrunksRoutes = new OpenAPIHono<{
  Variables: AuthVariables;
}>().openapi(listVoiceTrunksRoute, async (c) => {
  const { page, pageSize, search, carrier, ip, status, sortBy, sortDir } =
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
  if (status.length > 0) {
    filters.push(inArray(voiceTrunks.status, status));
  }
  const whereClause = and(...filters);

  const orderColumn = (() => {
    switch (sortBy) {
      case "carrierName":
        return carriers.name;
      case "voiceRateSheetName":
        return voiceRateSheets.name;
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
})
  .openapi(listTrunkIpsRoute, async (c) => {
    const { id } = c.req.valid("param");
    const trunk = await db
      .select({ id: voiceTrunks.id })
      .from(voiceTrunks)
      .where(and(eq(voiceTrunks.id, id), isNull(voiceTrunks.deletedAt)))
      .limit(1);
    if (!trunk[0]) {
      return c.json({ error: "not_found" }, 404);
    }
    const rows = await db
      .select({
        id: voiceTrunkIps.id,
        voiceTrunkId: voiceTrunkIps.voiceTrunkId,
        ip: voiceTrunkIps.ip,
        prefix: voiceTrunkIps.prefix,
        sourceCidr: voiceTrunkIps.sourceCidr,
        status: voiceTrunkIps.status,
        createdAt: voiceTrunkIps.createdAt,
        updatedAt: voiceTrunkIps.updatedAt,
      })
      .from(voiceTrunkIps)
      .where(
        and(
          eq(voiceTrunkIps.voiceTrunkId, id),
          isNull(voiceTrunkIps.deletedAt),
        ),
      )
      .orderBy(asc(voiceTrunkIps.ip), asc(voiceTrunkIps.prefix));
    return c.json(
      {
        ips: rows.map((r) => ({
          id: r.id,
          voiceTrunkId: r.voiceTrunkId,
          ip: r.ip,
          prefix: r.prefix,
          sourceCidr: r.sourceCidr,
          status: r.status,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        })),
      },
      200,
    );
  })
  .openapi(createTrunkIpRoute, async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");

    const trunk = await db
      .select({ id: voiceTrunks.id, carrierId: voiceTrunks.carrierId })
      .from(voiceTrunks)
      .where(and(eq(voiceTrunks.id, id), isNull(voiceTrunks.deletedAt)))
      .limit(1);
    const parent = trunk[0];
    if (!parent) {
      return c.json({ error: "not_found" }, 404);
    }

    if (body.kind === "single") {
      // Rule B preflight — friendlier error than the trigger.
      const conflict = await db
        .select({
          carrierId: voiceTrunks.carrierId,
          carrierName: carriers.name,
        })
        .from(voiceTrunkIps)
        .innerJoin(voiceTrunks, eq(voiceTrunks.id, voiceTrunkIps.voiceTrunkId))
        .innerJoin(carriers, eq(carriers.id, voiceTrunks.carrierId))
        .where(
          and(eq(voiceTrunkIps.ip, body.ip), isNull(voiceTrunkIps.deletedAt)),
        )
        .limit(1);
      const existing = conflict[0];
      if (existing && existing.carrierId !== parent.carrierId) {
        return c.json(
          {
            error: "ip_owned_by_other_carrier" as const,
            existingCarrierName: existing.carrierName,
          },
          409,
        );
      }

      try {
        const [row] = await db
          .insert(voiceTrunkIps)
          .values({
            voiceTrunkId: id,
            ip: body.ip,
            prefix: body.prefix,
            status: body.status,
          })
          .returning();
        if (!row) {
          return c.json({ error: "insert_failed" }, 500);
        }
        await publishLcrReload();
        return c.json(
          {
            id: row.id,
            voiceTrunkId: row.voiceTrunkId,
            ip: row.ip,
            prefix: row.prefix,
            sourceCidr: row.sourceCidr,
            status: row.status,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
          },
          201,
        );
      } catch (err) {
        const mapped = mapTrunkIpError(err);
        if (mapped) return c.json(mapped.body, mapped.status);
        throw err;
      }
    }

    // CIDR branch
    let expanded;
    try {
      expanded = expandCidr(body.cidr);
    } catch (err) {
      if (err instanceof CidrError) {
        return c.json(
          {
            error:
              err.code === "too_large"
                ? ("cidr_too_large" as const)
                : ("cidr_invalid" as const),
            detail: err.message,
          },
          422,
        );
      }
      throw err;
    }

    // Rule B batch preflight
    const conflict = await db
      .select({
        ip: voiceTrunkIps.ip,
        carrierId: voiceTrunks.carrierId,
        carrierName: carriers.name,
      })
      .from(voiceTrunkIps)
      .innerJoin(voiceTrunks, eq(voiceTrunks.id, voiceTrunkIps.voiceTrunkId))
      .innerJoin(carriers, eq(carriers.id, voiceTrunks.carrierId))
      .where(
        and(
          inArray(voiceTrunkIps.ip, expanded.hosts),
          isNull(voiceTrunkIps.deletedAt),
        ),
      )
      .limit(50);
    const offender = conflict.find((r) => r.carrierId !== parent.carrierId);
    if (offender) {
      return c.json(
        {
          error: "ip_owned_by_other_carrier" as const,
          existingCarrierName: offender.carrierName,
          conflictingIp: offender.ip,
        },
        409,
      );
    }

    try {
      const inserted = await db
        .insert(voiceTrunkIps)
        .values(
          expanded.hosts.map((host) => ({
            voiceTrunkId: id,
            ip: host,
            prefix: body.prefix,
            sourceCidr: expanded.canonicalCidr,
            status: body.status,
          })),
        )
        .onConflictDoNothing()
        .returning({ id: voiceTrunkIps.id });
      await publishLcrReload();
      return c.json(
        {
          kind: "cidr" as const,
          canonicalCidr: expanded.canonicalCidr,
          inserted: inserted.length,
          skipped: expanded.hosts.length - inserted.length,
        },
        201,
      );
    } catch (err) {
      const mapped = mapTrunkIpError(err);
      if (mapped) return c.json(mapped.body, mapped.status);
      throw err;
    }
  })
  .openapi(updateTrunkIpRoute, async (c) => {
    const { id, ipId } = c.req.valid("param");
    const body = c.req.valid("json");

    const trunk = await db
      .select({ id: voiceTrunks.id })
      .from(voiceTrunks)
      .where(and(eq(voiceTrunks.id, id), isNull(voiceTrunks.deletedAt)))
      .limit(1);
    if (!trunk[0]) {
      return c.json({ error: "not_found" }, 404);
    }

    if (body.prefix === undefined && body.status === undefined) {
      return c.json({ error: "no_changes" }, 400);
    }

    try {
      const updates: { prefix?: string | null; status?: "active" | "inactive" } =
        {};
      if (body.prefix !== undefined) updates.prefix = body.prefix;
      if (body.status !== undefined) updates.status = body.status;

      const [row] = await db
        .update(voiceTrunkIps)
        .set(updates)
        .where(
          and(
            eq(voiceTrunkIps.id, ipId),
            eq(voiceTrunkIps.voiceTrunkId, id),
            isNull(voiceTrunkIps.deletedAt),
          ),
        )
        .returning();
      if (!row) {
        return c.json({ error: "not_found" }, 404);
      }
      await publishLcrReload();
      return c.json(
        {
          id: row.id,
          voiceTrunkId: row.voiceTrunkId,
          ip: row.ip,
          prefix: row.prefix,
          sourceCidr: row.sourceCidr,
          status: row.status,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        },
        200,
      );
    } catch (err) {
      const mapped = mapTrunkIpError(err);
      if (mapped) return c.json(mapped.body, mapped.status);
      throw err;
    }
  })
  .openapi(updateTrunkIpRangeRoute, async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");

    const trunk = await db
      .select({ id: voiceTrunks.id })
      .from(voiceTrunks)
      .where(and(eq(voiceTrunks.id, id), isNull(voiceTrunks.deletedAt)))
      .limit(1);
    if (!trunk[0]) {
      return c.json({ error: "not_found" }, 404);
    }

    if (body.prefix === undefined && body.status === undefined) {
      return c.json({ error: "no_changes" }, 400);
    }

    const updates: { prefix?: string | null; status?: "active" | "inactive" } =
      {};
    if (body.prefix !== undefined) updates.prefix = body.prefix;
    if (body.status !== undefined) updates.status = body.status;

    try {
      const rows = await db
        .update(voiceTrunkIps)
        .set(updates)
        .where(
          and(
            eq(voiceTrunkIps.voiceTrunkId, id),
            eq(voiceTrunkIps.sourceCidr, body.sourceCidr),
            isNull(voiceTrunkIps.deletedAt),
          ),
        )
        .returning({ id: voiceTrunkIps.id });
      if (rows.length === 0) {
        return c.json({ error: "not_found" }, 404);
      }
      await publishLcrReload();
      return c.json({ affected: rows.length }, 200);
    } catch (err) {
      const mapped = mapTrunkIpError(err);
      if (mapped) return c.json(mapped.body, mapped.status);
      throw err;
    }
  })
  .openapi(deleteTrunkIpRangeRoute, async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");

    const rows = await db
      .update(voiceTrunkIps)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(voiceTrunkIps.voiceTrunkId, id),
          eq(voiceTrunkIps.sourceCidr, body.sourceCidr),
          isNull(voiceTrunkIps.deletedAt),
        ),
      )
      .returning({ id: voiceTrunkIps.id });
    if (rows.length === 0) {
      return c.json({ error: "not_found" }, 404);
    }
    await publishLcrReload();
    return c.json({ affected: rows.length }, 200);
  })
  .openapi(deleteTrunkIpRoute, async (c) => {
    const { id, ipId } = c.req.valid("param");

    const [row] = await db
      .update(voiceTrunkIps)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(voiceTrunkIps.id, ipId),
          eq(voiceTrunkIps.voiceTrunkId, id),
          isNull(voiceTrunkIps.deletedAt),
        ),
      )
      .returning({ id: voiceTrunkIps.id });
    if (!row) {
      return c.json({ error: "not_found" }, 404);
    }
    await publishLcrReload();
    return c.body(null, 204);
  });

type PgLikeError = {
  code?: string;
  message?: string;
  constraint?: string;
};

function mapTrunkIpError(
  err: unknown,
):
  | { status: 409; body: { error: "duplicate_ip" | "ip_owned_by_other_carrier" } }
  | null {
  if (!err || typeof err !== "object") return null;
  const e = err as PgLikeError;
  if (e.code !== "23505") return null;
  if (e.message?.includes("ip_owned_by_other_carrier")) {
    return { status: 409, body: { error: "ip_owned_by_other_carrier" } };
  }
  if (
    e.constraint === "voice_trunk_ips_trunk_ip_prefix_unique_active" ||
    e.message?.includes("voice_trunk_ips_trunk_ip_prefix_unique_active")
  ) {
    return { status: 409, body: { error: "duplicate_ip" } };
  }
  return null;
}
