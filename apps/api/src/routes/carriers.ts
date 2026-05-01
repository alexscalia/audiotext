import { Hono } from "hono";
import { isNull, desc } from "drizzle-orm";
import { db, carriers } from "@audiotext/db";
import { requireAuth, type AuthVariables } from "../lib/require-auth";

export const carriersRoutes = new Hono<{ Variables: AuthVariables }>().get(
  "/",
  requireAuth,
  async (c) => {
    const rows = await db
      .select({
        id: carriers.id,
        name: carriers.name,
        businessName: carriers.businessName,
        status: carriers.status,
        createdAt: carriers.createdAt,
        updatedAt: carriers.updatedAt,
      })
      .from(carriers)
      .where(isNull(carriers.deletedAt))
      .orderBy(desc(carriers.createdAt));

    return c.json({
      carriers: rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    });
  },
);
