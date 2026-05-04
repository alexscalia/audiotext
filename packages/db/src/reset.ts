import { Pool } from "pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");

if (process.env.NODE_ENV === "production") {
  throw new Error("db:reset is forbidden in production");
}

const pool = new Pool({ connectionString: url });
await pool.query("DROP SCHEMA IF EXISTS public CASCADE");
await pool.query("DROP SCHEMA IF EXISTS drizzle CASCADE");
await pool.query("CREATE SCHEMA public");
await pool.query("GRANT ALL ON SCHEMA public TO PUBLIC");
await pool.end();
console.log("schemas dropped + public recreated");
