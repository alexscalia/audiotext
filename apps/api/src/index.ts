import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { HealthSchema } from "@audiotext/shared";
import { auth } from "./lib/auth";

const PORT = Number(process.env.PORT ?? 3001);
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:3000";

const app = new Hono();

app.use("*", logger());

app.use(
  "/api/auth/*",
  cors({
    origin: WEB_ORIGIN,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["POST", "GET", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  }),
);

app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

const routes = app
  .get("/", (c) => c.json({ message: "Hello world!" }))
  .get("/health", (c) => {
    const body = HealthSchema.parse({
      ok: true,
      ts: new Date().toISOString(),
    });
    return c.json(body);
  })
  .get("/:slug", (c) => {
    const slug = c.req.param("slug");
    return c.json({ message: `Hello ${slug}!` });
  });

serve({ fetch: app.fetch, port: PORT }, ({ port }) => {
  console.log(`api listening on http://localhost:${port}`);
});

export type AppType = typeof routes;
