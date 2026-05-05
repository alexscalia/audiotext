import { serve } from "@hono/node-server";
import { OpenAPIHono } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { logger } from "hono/logger";
import { pool } from "@audiotext/db";
import { auth } from "./lib/auth";
import { carriersRoutes } from "./routes/admin/carriers";
import { voiceNumberingPlansRoutes } from "./routes/admin/voice-numbering-plans";

const PORT = Number(process.env.PORT ?? 3001);

const app = new OpenAPIHono();

app.use("*", logger());

app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.doc("/openapi.json", {
  openapi: "3.0.0",
  info: {
    title: "audiotext API",
    version: "0.0.0",
  },
});

app.get("/docs", swaggerUI({ url: "/openapi.json" }));

const routes = app
  .get("/", (c) => c.json({ message: "Hello world!" }))
  .get("/health", (c) =>
    c.json({ ok: true, ts: new Date().toISOString() }),
  )
  .route("/api/admin/carriers", carriersRoutes)
  .route("/api/admin/voice-numbering-plans", voiceNumberingPlansRoutes)
  .get("/:slug", (c) => c.json({ message: `Hello ${c.req.param("slug")}!` }));

const server = serve({ fetch: app.fetch, port: PORT }, ({ port }) => {
  console.log(`api listening on http://localhost:${port}`);
  console.log(`docs at http://localhost:${port}/docs`);
});

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`);
  server.close();
  await pool.end();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

export type AppType = typeof routes;
