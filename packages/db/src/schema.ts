import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  primaryKey,
  foreignKey,
  index,
  uniqueIndex,
  jsonb,
  check,
  integer,
  boolean,
  numeric,
} from "drizzle-orm/pg-core";

export type CarrierBillingDetails = {
  address: {
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postalCode: string;
    countryCode: string;
  };
  taxId?: string;
  paymentTerms?: string;
  bank?: {
    name: string;
    accountNumber: string;
    routingNumber?: string;
    iban?: string;
    swift?: string;
  };
  notes?: string;
};

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("users_email_unique_active")
      .on(t.email)
      .where(sql`${t.deletedAt} IS NULL`),
    index("users_deleted_at_idx").on(t.deletedAt),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("sessions_token_unique_active")
      .on(t.token)
      .where(sql`${t.deletedAt} IS NULL`),
    index("sessions_user_idx").on(t.userId),
    index("sessions_expires_at_idx").on(t.expiresAt),
    index("sessions_deleted_at_idx").on(t.deletedAt),
  ],
);

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("accounts_provider_account_unique_active")
      .on(t.providerId, t.accountId)
      .where(sql`${t.deletedAt} IS NULL`),
    index("accounts_user_idx").on(t.userId),
    index("accounts_deleted_at_idx").on(t.deletedAt),
  ],
);

export const verifications = pgTable(
  "verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("verifications_identifier_idx").on(t.identifier),
    index("verifications_expires_at_idx").on(t.expiresAt),
    index("verifications_deleted_at_idx").on(t.deletedAt),
  ],
);

export type SessionRow = typeof sessions.$inferSelect;
export type NewSessionRow = typeof sessions.$inferInsert;
export type AccountRow = typeof accounts.$inferSelect;
export type NewAccountRow = typeof accounts.$inferInsert;
export type VerificationRow = typeof verifications.$inferSelect;
export type NewVerificationRow = typeof verifications.$inferInsert;

export const roles = pgTable(
  "roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("roles_name_unique_active")
      .on(t.name)
      .where(sql`${t.deletedAt} IS NULL`),
    index("roles_deleted_at_idx").on(t.deletedAt),
  ],
);

export const permissions = pgTable(
  "permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("permissions_key_unique_active")
      .on(t.key)
      .where(sql`${t.deletedAt} IS NULL`),
    index("permissions_deleted_at_idx").on(t.deletedAt),
  ],
);

export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.roleId] }),
    index("user_roles_role_idx").on(t.roleId),
    index("user_roles_deleted_at_idx").on(t.deletedAt),
  ],
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
    grantedAt: timestamp("granted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.roleId, t.permissionId] }),
    index("role_permissions_permission_idx").on(t.permissionId),
    index("role_permissions_deleted_at_idx").on(t.deletedAt),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  userRoles: many(userRoles),
  sessions: many(sessions),
  accounts: many(accounts),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  userRoles: many(userRoles),
  rolePermissions: many(rolePermissions),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, { fields: [userRoles.userId], references: [users.id] }),
  role: one(roles, { fields: [userRoles.roleId], references: [roles.id] }),
}));

export const rolePermissionsRelations = relations(
  rolePermissions,
  ({ one }) => ({
    role: one(roles, {
      fields: [rolePermissions.roleId],
      references: [roles.id],
    }),
    permission: one(permissions, {
      fields: [rolePermissions.permissionId],
      references: [permissions.id],
    }),
  }),
);

export const carriers = pgTable(
  "carriers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    businessName: text("business_name").notNull(),
    billingDetails: jsonb("billing_details")
      .$type<CarrierBillingDetails>()
      .notNull(),
    ratesName: text("rates_name").notNull(),
    ratesEmail: text("rates_email").notNull(),
    billingName: text("billing_name").notNull(),
    billingEmail: text("billing_email").notNull(),
    nocName: text("noc_name").notNull(),
    nocEmail: text("noc_email").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("carriers_name_unique_active")
      .on(t.name)
      .where(sql`${t.deletedAt} IS NULL`),
    index("carriers_deleted_at_idx").on(t.deletedAt),
  ],
);

export type CarrierRow = typeof carriers.$inferSelect;
export type NewCarrierRow = typeof carriers.$inferInsert;

export const chatApp = pgEnum("chat_app", ["whatsapp", "telegram", "signal"]);
export type ChatApp = (typeof chatApp.enumValues)[number];

export const chatContacts = pgTable(
  "chat_contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    carrierId: uuid("carrier_id").references(() => carriers.id, {
      onDelete: "cascade",
    }),
    chatApp: chatApp("chat_app").notNull(),
    chatId: text("chat_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    check(
      "chat_contacts_owner_xor",
      sql`((${t.userId} IS NOT NULL)::int + (${t.carrierId} IS NOT NULL)::int) = 1`,
    ),
    index("chat_contacts_user_idx").on(t.userId),
    index("chat_contacts_carrier_idx").on(t.carrierId),
    index("chat_contacts_app_id_idx").on(t.chatApp, t.chatId),
    index("chat_contacts_deleted_at_idx").on(t.deletedAt),
  ],
);

export type ChatContactRow = typeof chatContacts.$inferSelect;
export type NewChatContactRow = typeof chatContacts.$inferInsert;

export const chatContactsRelations = relations(chatContacts, ({ one }) => ({
  user: one(users, {
    fields: [chatContacts.userId],
    references: [users.id],
  }),
  carrier: one(carriers, {
    fields: [chatContacts.carrierId],
    references: [carriers.id],
  }),
}));

export const atVoiceTerminationStatus = pgEnum("at_voice_termination_status", [
  "active",
  "inactive",
]);
export type AtVoiceTerminationStatus =
  (typeof atVoiceTerminationStatus.enumValues)[number];

export const currency = pgEnum("currency", ["usd", "eur", "gbp"]);
export type Currency = (typeof currency.enumValues)[number];

export const atVoiceTerminations = pgTable(
  "at_voice_terminations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    status: atVoiceTerminationStatus("status").notNull().default("active"),
    carrierId: uuid("carrier_id")
      .notNull()
      .references(() => carriers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    internalRouteName: text("internal_route_name").notNull(),
    currency: currency("currency").notNull(),
    countryCode: text("country_code").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("at_voice_terminations_carrier_internal_unique_active")
      .on(t.carrierId, t.internalRouteName)
      .where(sql`${t.deletedAt} IS NULL`),
    check(
      "at_voice_terminations_country_code_iso2",
      sql`${t.countryCode} ~ '^[A-Z]{2}$'`,
    ),
    index("at_voice_terminations_carrier_idx").on(t.carrierId),
    index("at_voice_terminations_status_idx").on(t.status),
    index("at_voice_terminations_country_idx").on(t.countryCode),
    index("at_voice_terminations_deleted_at_idx").on(t.deletedAt),
  ],
);

export type AtVoiceTerminationRow = typeof atVoiceTerminations.$inferSelect;
export type NewAtVoiceTerminationRow = typeof atVoiceTerminations.$inferInsert;

export const atVoiceTerminationsRelations = relations(atVoiceTerminations, ({ one, many }) => ({
  carrier: one(carriers, {
    fields: [atVoiceTerminations.carrierId],
    references: [carriers.id],
  }),
  atVoiceNumbers: many(atVoiceNumbers),
}));

export const atVoiceNumbers = pgTable(
  "at_voice_numbers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    atVoiceTerminationId: uuid("at_voice_termination_id").notNull(),
    number: text("number").notNull(),
    lastSuccessfulAttemptAt: timestamp("last_successful_attempt_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("at_voice_numbers_number_unique_active")
      .on(t.number)
      .where(sql`${t.deletedAt} IS NULL`),
    index("at_voice_numbers_at_voice_termination_idx").on(t.atVoiceTerminationId),
    index("at_voice_numbers_last_success_idx").on(t.lastSuccessfulAttemptAt),
    index("at_voice_numbers_deleted_at_idx").on(t.deletedAt),
    foreignKey({
      name: "at_voice_numbers_at_voice_termination_id_fk",
      columns: [t.atVoiceTerminationId],
      foreignColumns: [atVoiceTerminations.id],
    }).onDelete("cascade"),
  ],
);

export type AtVoiceNumberRow = typeof atVoiceNumbers.$inferSelect;
export type NewAtVoiceNumberRow = typeof atVoiceNumbers.$inferInsert;

export const atVoiceNumbersRelations = relations(atVoiceNumbers, ({ one }) => ({
  termination: one(atVoiceTerminations, {
    fields: [atVoiceNumbers.atVoiceTerminationId],
    references: [atVoiceTerminations.id],
  }),
}));

export const carriersRelations = relations(carriers, ({ many }) => ({
  atVoiceTerminations: many(atVoiceTerminations),
  chatContacts: many(chatContacts),
  voiceTrunks: many(voiceTrunks),
}));

export const voiceTrunkStatus = pgEnum("voice_trunk_status", [
  "active",
  "inactive",
  "testing",
]);
export type VoiceTrunkStatus = (typeof voiceTrunkStatus.enumValues)[number];

export const voiceTrunkDirection = pgEnum("voice_trunk_direction", [
  "inbound",
  "outbound",
  "both",
]);
export type VoiceTrunkDirection =
  (typeof voiceTrunkDirection.enumValues)[number];

export const voiceTrunkProtocol = pgEnum("voice_trunk_protocol", [
  "sip",
  "sips",
]);
export type VoiceTrunkProtocol =
  (typeof voiceTrunkProtocol.enumValues)[number];

export const voiceTrunkTransport = pgEnum("voice_trunk_transport", [
  "udp",
  "tcp",
  "tls",
]);
export type VoiceTrunkTransport =
  (typeof voiceTrunkTransport.enumValues)[number];

export const voiceTrunkAuthType = pgEnum("voice_trunk_auth_type", [
  "ip",
  "userpass",
  "both",
]);
export type VoiceTrunkAuthType =
  (typeof voiceTrunkAuthType.enumValues)[number];

export const voiceTrunkDtmfMode = pgEnum("voice_trunk_dtmf_mode", [
  "rfc2833",
  "inband",
  "info",
]);
export type VoiceTrunkDtmfMode =
  (typeof voiceTrunkDtmfMode.enumValues)[number];

export const voiceTrunkNatMode = pgEnum("voice_trunk_nat_mode", [
  "no",
  "yes",
  "force_rport",
  "comedia",
]);
export type VoiceTrunkNatMode =
  (typeof voiceTrunkNatMode.enumValues)[number];

export const voiceTrunks = pgTable(
  "voice_trunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    carrierId: uuid("carrier_id")
      .notNull()
      .references(() => carriers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    status: voiceTrunkStatus("status").notNull().default("active"),
    direction: voiceTrunkDirection("direction").notNull().default("both"),
    protocol: voiceTrunkProtocol("protocol").notNull().default("sip"),
    transport: voiceTrunkTransport("transport").notNull().default("udp"),
    host: text("host").notNull(),
    port: integer("port").notNull().default(5060),
    authType: voiceTrunkAuthType("auth_type").notNull(),
    username: text("username"),
    passwordEncrypted: text("password_encrypted"),
    realm: text("realm"),
    fromUser: text("from_user"),
    fromDomain: text("from_domain"),
    register: boolean("register").notNull().default(false),
    proxy: text("proxy"),
    expiresSeconds: integer("expires_seconds"),
    qualifySeconds: integer("qualify_seconds"),
    maxChannels: integer("max_channels"),
    cpsLimit: integer("cps_limit"),
    codecs: jsonb("codecs")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    dtmfMode: voiceTrunkDtmfMode("dtmf_mode").notNull().default("rfc2833"),
    natMode: voiceTrunkNatMode("nat_mode").notNull().default("no"),
    ipAcl: jsonb("ip_acl").$type<string[]>(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("voice_trunks_carrier_name_unique_active")
      .on(t.carrierId, t.name)
      .where(sql`${t.deletedAt} IS NULL`),
    index("voice_trunks_carrier_idx").on(t.carrierId),
    index("voice_trunks_status_idx").on(t.status),
    index("voice_trunks_deleted_at_idx").on(t.deletedAt),
    check("voice_trunks_port_range", sql`${t.port} BETWEEN 1 AND 65535`),
    check(
      "voice_trunks_auth_userpass_complete",
      sql`${t.authType} NOT IN ('userpass','both') OR (${t.username} IS NOT NULL AND ${t.passwordEncrypted} IS NOT NULL)`,
    ),
    check(
      "voice_trunks_auth_ip_complete",
      sql`${t.authType} NOT IN ('ip','both') OR (${t.ipAcl} IS NOT NULL AND jsonb_array_length(${t.ipAcl}) > 0)`,
    ),
    check(
      "voice_trunks_max_channels_positive",
      sql`${t.maxChannels} IS NULL OR ${t.maxChannels} > 0`,
    ),
    check(
      "voice_trunks_cps_limit_positive",
      sql`${t.cpsLimit} IS NULL OR ${t.cpsLimit} > 0`,
    ),
  ],
);

export type VoiceTrunkRow = typeof voiceTrunks.$inferSelect;
export type NewVoiceTrunkRow = typeof voiceTrunks.$inferInsert;

export const voiceTrunksRelations = relations(voiceTrunks, ({ one }) => ({
  carrier: one(carriers, {
    fields: [voiceTrunks.carrierId],
    references: [carriers.id],
  }),
}));

export const numberingPlanStatus = pgEnum("numbering_plan_status", [
  "active",
  "inactive",
]);
export type NumberingPlanStatus =
  (typeof numberingPlanStatus.enumValues)[number];

export const numberingPlans = pgTable(
  "numbering_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    status: numberingPlanStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("numbering_plans_name_unique_active")
      .on(t.name)
      .where(sql`${t.deletedAt} IS NULL`),
    index("numbering_plans_status_idx").on(t.status),
    index("numbering_plans_deleted_at_idx").on(t.deletedAt),
  ],
);

export type NumberingPlanRow = typeof numberingPlans.$inferSelect;
export type NewNumberingPlanRow = typeof numberingPlans.$inferInsert;

export const numberingPlanLines = pgTable(
  "numbering_plan_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    numberingPlanId: uuid("numbering_plan_id")
      .notNull()
      .references(() => numberingPlans.id, { onDelete: "cascade" }),
    countryCode: text("country_code").notNull(),
    areaCode: text("area_code"),
    operatorName: text("operator_name").notNull(),
    minDigits: integer("min_digits").notNull(),
    maxDigits: integer("max_digits").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex(
      "numbering_plan_lines_plan_country_area_operator_unique_active",
    )
      .on(t.numberingPlanId, t.countryCode, t.areaCode, t.operatorName)
      .where(sql`${t.deletedAt} IS NULL`),
    index("numbering_plan_lines_plan_idx").on(t.numberingPlanId),
    index("numbering_plan_lines_country_idx").on(t.countryCode),
    index("numbering_plan_lines_country_area_idx").on(
      t.countryCode,
      t.areaCode,
    ),
    index("numbering_plan_lines_deleted_at_idx").on(t.deletedAt),
    check(
      "numbering_plan_lines_country_code_iso2",
      sql`${t.countryCode} ~ '^[A-Z]{2}$'`,
    ),
    check("numbering_plan_lines_min_digits_positive", sql`${t.minDigits} > 0`),
    check("numbering_plan_lines_max_digits_positive", sql`${t.maxDigits} > 0`),
    check(
      "numbering_plan_lines_digits_range",
      sql`${t.minDigits} <= ${t.maxDigits}`,
    ),
  ],
);

export type NumberingPlanLineRow = typeof numberingPlanLines.$inferSelect;
export type NewNumberingPlanLineRow = typeof numberingPlanLines.$inferInsert;

export const numberingPlansRelations = relations(
  numberingPlans,
  ({ many }) => ({
    lines: many(numberingPlanLines),
  }),
);

export const numberingPlanLinesRelations = relations(
  numberingPlanLines,
  ({ one }) => ({
    plan: one(numberingPlans, {
      fields: [numberingPlanLines.numberingPlanId],
      references: [numberingPlans.id],
    }),
  }),
);

export const voiceCdrs = pgTable(
  "voice_cdrs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    durationSecs: integer("duration_secs").notNull(),
    buyCurrency: currency("buy_currency").notNull(),
    buyRate: numeric("buy_rate", { precision: 18, scale: 6 }).notNull(),
    sellCurrency: currency("sell_currency").notNull(),
    sellRate: numeric("sell_rate", { precision: 18, scale: 6 }).notNull(),
    internalRouteName: text("internal_route_name").notNull(),
    inboundRouteName: text("inbound_route_name"),
    outboundRouteName: text("outbound_route_name"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("voice_cdrs_started_at_idx").on(t.startedAt),
    index("voice_cdrs_internal_route_idx").on(t.internalRouteName),
    index("voice_cdrs_deleted_at_idx").on(t.deletedAt),
    check("voice_cdrs_duration_non_negative", sql`${t.durationSecs} >= 0`),
    check(
      "voice_cdrs_ended_after_started",
      sql`${t.endedAt} IS NULL OR ${t.endedAt} >= ${t.startedAt}`,
    ),
  ],
);

export type VoiceCdrRow = typeof voiceCdrs.$inferSelect;
export type NewVoiceCdrRow = typeof voiceCdrs.$inferInsert;

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type RoleRow = typeof roles.$inferSelect;
export type NewRoleRow = typeof roles.$inferInsert;
export type PermissionRow = typeof permissions.$inferSelect;
export type NewPermissionRow = typeof permissions.$inferInsert;
export type UserRoleRow = typeof userRoles.$inferSelect;
export type RolePermissionRow = typeof rolePermissions.$inferSelect;
