import { and, eq, isNull } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");

const pool = new Pool({ connectionString: url });
const db = drizzle(pool, { schema });

const ADMIN_ROLE_NAME = "admin";
const PASSWORD = "password";

const ADMINS = [
  { email: "admin001@admin.com", name: "Admin 001" },
  { email: "admin002@admin.com", name: "Admin 002" },
];

async function ensureAdminRole(): Promise<string> {
  const existing = await db
    .select()
    .from(schema.roles)
    .where(
      and(eq(schema.roles.name, ADMIN_ROLE_NAME), isNull(schema.roles.deletedAt)),
    )
    .limit(1);
  if (existing[0]) return existing[0].id;

  const [created] = await db
    .insert(schema.roles)
    .values({ name: ADMIN_ROLE_NAME, description: "Administrator" })
    .returning({ id: schema.roles.id });
  if (!created) throw new Error("failed to create admin role");
  return created.id;
}

async function seedAdmin(
  email: string,
  name: string,
  roleId: string,
  passwordHash: string,
): Promise<void> {
  const existingUser = await db
    .select()
    .from(schema.users)
    .where(and(eq(schema.users.email, email), isNull(schema.users.deletedAt)))
    .limit(1);

  let userId: string;
  if (existingUser[0]) {
    userId = existingUser[0].id;
    console.log(`user exists: ${email} (${userId})`);
  } else {
    const [created] = await db
      .insert(schema.users)
      .values({ email, name, emailVerified: true })
      .returning({ id: schema.users.id });
    if (!created) throw new Error(`failed to create user: ${email}`);
    userId = created.id;
    console.log(`user created: ${email} (${userId})`);
  }

  const existingAccount = await db
    .select()
    .from(schema.accounts)
    .where(
      and(
        eq(schema.accounts.providerId, "credential"),
        eq(schema.accounts.accountId, userId),
        isNull(schema.accounts.deletedAt),
      ),
    )
    .limit(1);

  if (existingAccount[0]) {
    await db
      .update(schema.accounts)
      .set({ password: passwordHash })
      .where(eq(schema.accounts.id, existingAccount[0].id));
    console.log(`credential updated: ${email}`);
  } else {
    await db.insert(schema.accounts).values({
      userId,
      accountId: userId,
      providerId: "credential",
      password: passwordHash,
    });
    console.log(`credential created: ${email}`);
  }

  const existingAssignment = await db
    .select()
    .from(schema.userRoles)
    .where(
      and(
        eq(schema.userRoles.userId, userId),
        eq(schema.userRoles.roleId, roleId),
        isNull(schema.userRoles.deletedAt),
      ),
    )
    .limit(1);

  if (!existingAssignment[0]) {
    await db.insert(schema.userRoles).values({ userId, roleId });
    console.log(`admin role assigned: ${email}`);
  }
}

async function main() {
  const passwordHash = await hashPassword(PASSWORD);
  const roleId = await ensureAdminRole();
  for (const admin of ADMINS) {
    await seedAdmin(admin.email, admin.name, roleId, passwordHash);
  }
  console.log("seed complete");
}

try {
  await main();
} finally {
  await pool.end();
}
