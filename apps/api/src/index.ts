import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { pool } from "@audiotext/db";
import { auth } from "./lib/auth";

const PORT = Number(process.env.PORT ?? 3001);

const app = new Hono();

app.use("*", logger());

app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

const routes = app
  .get("/", (c) => c.json({ message: "Hello world!" }))
  .get("/health", (c) =>
    c.json({ ok: true, ts: new Date().toISOString() }),
  )
  .get("/:slug", (c) => c.json({ message: `Hello ${c.req.param("slug")}!` }));

const server = serve({ fetch: app.fetch, port: PORT }, ({ port }) => {
  console.log(`api listening on http://localhost:${port}`);
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
