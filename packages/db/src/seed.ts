import { and, eq, isNull } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";
import type {
  CarrierBillingDetails,
  ChatApp,
  NewCarrierRow,
} from "./schema.js";
import { seedVoiceNumberingPlan } from "./seed-voice-numbering-plan.js";

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

type CarrierSeed = Omit<NewCarrierRow, "id" | "createdAt" | "updatedAt" | "deletedAt">;

type ChatContactSeed = {
  chatApp: ChatApp;
  chatId: string;
};

type CarrierFixture = {
  carrier: CarrierSeed;
  contacts: ChatContactSeed[];
};

const CARRIERS: CarrierFixture[] = [
  {
    carrier: {
      name: "acme-telecom",
      businessName: "Acme Telecom S.p.A.",
      ratesName: "Marco Rossi",
      ratesEmail: "rates@acme-telecom.com",
      billingName: "Giulia Bianchi",
      billingEmail: "billing@acme-telecom.com",
      nocName: "NOC Acme",
      nocEmail: "noc@acme-telecom.com",
      salesName: "Luca Verdi",
      salesEmail: "sales@acme-telecom.com",
      billingDetails: {
        address: {
          line1: "Via Roma 12",
          city: "Milano",
          postalCode: "20121",
          countryCode: "IT",
        },
        taxId: "IT12345678901",
        paymentTerms: "net30",
        bank: {
          name: "Intesa Sanpaolo",
          accountNumber: "0001234567",
          iban: "IT60X0542811101000000123456",
          swift: "BCITITMM",
        },
      } satisfies CarrierBillingDetails,
    },
    contacts: [
      { chatApp: "whatsapp", chatId: "+390212345001" },
      { chatApp: "telegram", chatId: "@acme_noc" },
    ],
  },
  {
    carrier: {
      name: "globex-voice",
      businessName: "Globex Voice Ltd.",
      ratesName: "Sarah Connor",
      ratesEmail: "rates@globex.io",
      billingName: "John Doe",
      billingEmail: "ar@globex.io",
      nocName: "Globex NOC",
      nocEmail: "noc@globex.io",
      salesName: "Kyle Reese",
      salesEmail: "sales@globex.io",
      billingDetails: {
        address: {
          line1: "221B Baker Street",
          city: "London",
          postalCode: "NW1 6XE",
          countryCode: "GB",
        },
        taxId: "GB123456789",
        paymentTerms: "net15",
      } satisfies CarrierBillingDetails,
    },
    contacts: [
      { chatApp: "whatsapp", chatId: "+447700900123" },
      { chatApp: "signal", chatId: "+447700900124" },
    ],
  },
  {
    carrier: {
      name: "initech-carrier",
      businessName: "Initech Communications LLC",
      ratesName: "Peter Gibbons",
      ratesEmail: "rates@initech.com",
      billingName: "Bill Lumbergh",
      billingEmail: "billing@initech.com",
      nocName: "Initech NOC",
      nocEmail: "noc@initech.com",
      salesName: "Michael Bolton",
      salesEmail: "sales@initech.com",
      billingDetails: {
        address: {
          line1: "4120 Freidrich Lane",
          city: "Austin",
          state: "TX",
          postalCode: "78744",
          countryCode: "US",
        },
        taxId: "US-EIN-12-3456789",
        paymentTerms: "net45",
        notes: "Send invoices PDF only",
      } satisfies CarrierBillingDetails,
    },
    contacts: [{ chatApp: "telegram", chatId: "@initech_ops" }],
  },
];

async function seedCarrier(fixture: CarrierFixture): Promise<string> {
  const existing = await db
    .select()
    .from(schema.carriers)
    .where(
      and(
        eq(schema.carriers.name, fixture.carrier.name),
        isNull(schema.carriers.deletedAt),
      ),
    )
    .limit(1);

  let carrierId: string;
  if (existing[0]) {
    carrierId = existing[0].id;
    console.log(`carrier exists: ${fixture.carrier.name} (${carrierId})`);
  } else {
    const [created] = await db
      .insert(schema.carriers)
      .values(fixture.carrier)
      .returning({ id: schema.carriers.id });
    if (!created)
      throw new Error(`failed to create carrier: ${fixture.carrier.name}`);
    carrierId = created.id;
    console.log(`carrier created: ${fixture.carrier.name} (${carrierId})`);
  }

  for (const contact of fixture.contacts) {
    await ensureChatContact({ carrierId }, contact);
  }
  return carrierId;
}

async function ensureChatContact(
  owner: { userId?: string; carrierId?: string },
  contact: ChatContactSeed,
): Promise<void> {
  const ownerFilter = owner.userId
    ? eq(schema.chatContacts.userId, owner.userId)
    : eq(schema.chatContacts.carrierId, owner.carrierId!);

  const existing = await db
    .select()
    .from(schema.chatContacts)
    .where(
      and(
        ownerFilter,
        eq(schema.chatContacts.chatApp, contact.chatApp),
        eq(schema.chatContacts.chatId, contact.chatId),
        isNull(schema.chatContacts.deletedAt),
      ),
    )
    .limit(1);

  if (existing[0]) {
    console.log(
      `chat_contact exists: ${contact.chatApp}:${contact.chatId} -> ${owner.userId ?? owner.carrierId}`,
    );
    return;
  }

  await db.insert(schema.chatContacts).values({
    userId: owner.userId ?? null,
    carrierId: owner.carrierId ?? null,
    chatApp: contact.chatApp,
    chatId: contact.chatId,
  });
  console.log(
    `chat_contact created: ${contact.chatApp}:${contact.chatId} -> ${owner.userId ?? owner.carrierId}`,
  );
}

async function seedAdminChatContacts(): Promise<void> {
  const adminContacts: Record<string, ChatContactSeed[]> = {
    "admin001@admin.com": [{ chatApp: "telegram", chatId: "@admin001" }],
    "admin002@admin.com": [{ chatApp: "whatsapp", chatId: "+10000000002" }],
  };

  for (const [email, contacts] of Object.entries(adminContacts)) {
    const [user] = await db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.email, email), isNull(schema.users.deletedAt)))
      .limit(1);
    if (!user) continue;
    for (const contact of contacts) {
      await ensureChatContact({ userId: user.id }, contact);
    }
  }
}

async function main() {
  const passwordHash = await hashPassword(PASSWORD);
  const roleId = await ensureAdminRole();
  for (const admin of ADMINS) {
    await seedAdmin(admin.email, admin.name, roleId, passwordHash);
  }
  for (const fixture of CARRIERS) {
    await seedCarrier(fixture);
  }
  await seedAdminChatContacts();
  await seedVoiceNumberingPlan(db);
  console.log("seed complete");
}

try {
  await main();
} finally {
  await pool.end();
}
