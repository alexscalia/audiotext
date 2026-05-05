import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { asc, isNull } from "drizzle-orm";
import { db, countries } from "@audiotext/db";
import {
  CountryListQuerySchema,
  CountryListResponseSchema,
} from "@audiotext/shared";
import { requireAuth, type AuthVariables } from "../../lib/require-auth";

const listCountriesRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Countries"],
  summary: "List countries with localized names, sorted A–Z",
  middleware: [requireAuth] as const,
  request: {
    query: CountryListQuerySchema,
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: CountryListResponseSchema },
      },
      description: "Active countries, sorted by localized name",
    },
    401: {
      description: "Unauthorized",
    },
  },
});

export const countriesRoutes = new OpenAPIHono<{
  Variables: AuthVariables;
}>().openapi(listCountriesRoute, async (c) => {
  const { locale } = c.req.valid("query");
  const nameCol = locale === "it" ? countries.nameIt : countries.nameEn;

  const rows = await db
    .select({ iso2: countries.iso2, name: nameCol })
    .from(countries)
    .where(isNull(countries.deletedAt))
    .orderBy(asc(nameCol));

  return c.json({ countries: rows }, 200);
});
