import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { isNull, desc, and, eq } from "drizzle-orm";
import {
  db,
  voiceRateSheets,
  voiceNumberingPlans,
} from "@audiotext/db";
import { VoiceRateSheetListResponseSchema } from "@audiotext/shared";
import { requireAuth, type AuthVariables } from "../../lib/require-auth";

const listVoiceRateSheetsRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["VoiceRateSheets"],
  summary: "List voice rate sheets with associated numbering plan name",
  middleware: [requireAuth] as const,
  responses: {
    200: {
      content: {
        "application/json": { schema: VoiceRateSheetListResponseSchema },
      },
      description: "List of active voice rate sheets",
    },
    401: { description: "Unauthorized" },
  },
});

export const voiceRateSheetsRoutes = new OpenAPIHono<{
  Variables: AuthVariables;
}>().openapi(listVoiceRateSheetsRoute, async (c) => {
  const rows = await db
    .select({
      id: voiceRateSheets.id,
      name: voiceRateSheets.name,
      status: voiceRateSheets.status,
      voiceNumberingPlanId: voiceRateSheets.voiceNumberingPlanId,
      voiceNumberingPlanName: voiceNumberingPlans.name,
      currencyIso: voiceRateSheets.currencyIso,
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
    .where(isNull(voiceRateSheets.deletedAt))
    .orderBy(desc(voiceRateSheets.createdAt));

  return c.json(
    {
      rateSheets: rows.map((r) => ({
        id: r.id,
        name: r.name,
        status: r.status,
        voiceNumberingPlanId: r.voiceNumberingPlanId,
        voiceNumberingPlanName: r.voiceNumberingPlanName,
        currencyIso: r.currencyIso,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    },
    200,
  );
});
