import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { isNull, desc } from "drizzle-orm";
import { db, carriers } from "@audiotext/db";
import { CarrierListResponseSchema } from "@audiotext/shared";
import { requireAuth, type AuthVariables } from "../lib/require-auth";

const listCarriersRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Carriers"],
  summary: "List carriers",
  middleware: [requireAuth] as const,
  responses: {
    200: {
      content: {
        "application/json": { schema: CarrierListResponseSchema },
      },
      description: "List of active carriers",
    },
    401: {
      description: "Unauthorized",
    },
  },
});

export const carriersRoutes = new OpenAPIHono<{
  Variables: AuthVariables;
}>().openapi(listCarriersRoute, async (c) => {
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

  return c.json(
    {
      carriers: rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    },
    200,
  );
});
