/**
 * Naming conventions:
 * - Tables: plural, snake_case in SQL, camelCase TS export.
 * - Columns: camelCase TS ↔ snake_case SQL.
 * - FKs: <refTable>Id / <ref_table>_id.
 * - Timestamps: *At suffix (createdAt, updatedAt, deletedAt, expiresAt, ...).
 * - Booleans: attribute names, no is_ prefix (emailVerified, registerEnabled).
 * - Time units: spelled out — Seconds, Minutes, Hours, Days. Never Sec/Secs/Min/Mins.
 * - Country codes (ISO 3166-1 alpha-2 SQL columns): countryIso2.
 *   Exception: nested JSON `CarrierBillingDetails.address.countryCode` stays
 *   for compatibility with the address shape used by UI/i18n.
 * - Currency: `currency` pgEnum (usd/eur/gbp). Unprefixed = shared cross-table enum.
 * - Soft delete: deletedAt + uniqueIndex(...).where(`deleted_at IS NULL`)
 *   named `<table>_<cols>_unique_active`.
 * - Indexes: <table>_<cols>_idx. FKs: <table>_<col>_<reftable>_<refcol>_fk.
 * - Relations export: <table>Relations. Types: <Table>Row / New<Table>Row.
 * - Domain table prefixes: `at_*` denotes AudioText-specific range
 *   pool tables (at_voice_ranges, at_voice_numbers, at_range_users);
 *   the generic voice infra (voice_trunks, voice_numbering_plans, ...) is unprefixed.
 */

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
  billingTerms?: {
    cycleDays: number;
    dueDays: number;
  };
  bank?: {
    name: string;
    accountNumber: string;
    routingNumber?: string;
    iban?: string;
    swift?: string;
  };
  notes?: string;
};

export const userStatus = pgEnum("user_status", [
  "active",
  "pending",
  "inactive",
  "suspended",
  "banned",
]);
export type UserStatus = (typeof userStatus.enumValues)[number];

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    status: userStatus("status").notNull().default("active"),
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
    index("users_status_idx").on(t.status),
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

export const roleScope = pgEnum("role_scope", ["admin", "user"]);

export const roles = pgTable(
  "roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scope: roleScope("scope").notNull(),
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
    uniqueIndex("roles_scope_name_unique_active")
      .on(t.scope, t.name)
      .where(sql`${t.deletedAt} IS NULL`),
    index("roles_scope_idx").on(t.scope),
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

export const carrierStatus = pgEnum("carrier_status", ["active", "inactive"]);
export type CarrierStatus = (typeof carrierStatus.enumValues)[number];

export const carriers = pgTable(
  "carriers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    businessName: text("business_name").notNull(),
    status: carrierStatus("status").notNull().default("active"),
    billingDetails: jsonb("billing_details")
      .$type<CarrierBillingDetails>()
      .notNull(),
    ratesName: text("rates_name").notNull(),
    ratesEmail: text("rates_email").notNull(),
    ratesPhone: text("rates_phone"),
    billingName: text("billing_name").notNull(),
    billingEmail: text("billing_email").notNull(),
    billingPhone: text("billing_phone"),
    nocName: text("noc_name").notNull(),
    nocEmail: text("noc_email").notNull(),
    nocPhone: text("noc_phone"),
    salesName: text("sales_name").notNull(),
    salesEmail: text("sales_email").notNull(),
    salesPhone: text("sales_phone"),
    timezone: text("timezone").notNull().default("UTC"),
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
    index("carriers_status_idx").on(t.status),
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

export const atVoiceRangeStatus = pgEnum("at_voice_range_status", [
  "active",
  "inactive",
]);
export type AtVoiceRangeStatus =
  (typeof atVoiceRangeStatus.enumValues)[number];

export const atVoiceRangeType = pgEnum("at_voice_range_type", [
  "generated",
  "assigned",
]);
export type AtVoiceRangeType =
  (typeof atVoiceRangeType.enumValues)[number];

export const currency = pgEnum("currency", ["usd", "eur", "gbp"]);
export type Currency = (typeof currency.enumValues)[number];

export const atVoiceRanges = pgTable(
  "at_voice_ranges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    status: atVoiceRangeStatus("status").notNull().default("active"),
    type: atVoiceRangeType("type").notNull(),
    carrierId: uuid("carrier_id")
      .notNull()
      .references(() => carriers.id, { onDelete: "cascade" }),
    voiceNumberingPlanDestinationId: uuid("voice_numbering_plan_destination_id")
      .notNull()
      .references(() => voiceNumberingPlanDestinations.id, {
        onDelete: "restrict",
      }),
    name: text("name").notNull(),
    currency: currency("currency").notNull(),
    carrierCurrency: currency("carrier_currency").notNull(),
    carrierRatePerMinute: numeric("carrier_rate_per_minute", {
      precision: 18,
      scale: 6,
    }).notNull(),
    carrierBillingCycleDays: integer("carrier_billing_cycle_days").notNull(),
    carrierPaymentTermsDays: integer("carrier_payment_terms_days").notNull(),
    payoutPerMinuteWeekly: numeric("payout_per_minute_weekly", {
      precision: 18,
      scale: 6,
    }).notNull(),
    payoutPerMinuteLongTerm: numeric("payout_per_minute_long_term", {
      precision: 18,
      scale: 6,
    }).notNull(),
    payoutBillingCycleDays: integer("payout_billing_cycle_days").notNull(),
    payoutPaymentTermsDays: integer("payout_payment_terms_days").notNull(),
    countryIso2: text("country_iso2").notNull(),
    maxDailyTotalMinutes: integer("max_daily_total_minutes"),
    maxDailyMinutesANumber: integer("max_daily_minutes_a_number"),
    maxDailyMinutesBNumber: integer("max_daily_minutes_b_number"),
    maxDailyMinutesAToBNumber: integer("max_daily_minutes_a_to_b_number"),
    maxCallDurationMinutes: integer("max_call_duration_minutes"),
    targetAcdMinutes: integer("target_acd_minutes"),
    targetAsrPercent: integer("target_asr_percent"),
    maxANumberConcurrentCalls: integer("max_a_number_concurrent_calls"),
    maxBNumberConcurrentCalls: integer("max_b_number_concurrent_calls"),
    maxAToBNumberConcurrentCalls: integer("max_a_to_b_number_concurrent_calls"),
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
    uniqueIndex("at_voice_ranges_carrier_name_unique_active")
      .on(t.carrierId, t.name)
      .where(sql`${t.deletedAt} IS NULL`),
    check(
      "at_voice_ranges_country_iso2_format",
      sql`${t.countryIso2} ~ '^[A-Z]{2}$'`,
    ),
    check(
      "at_voice_ranges_carrier_rate_per_minute_non_negative",
      sql`${t.carrierRatePerMinute} >= 0`,
    ),
    check(
      "at_voice_ranges_payout_per_minute_weekly_non_negative",
      sql`${t.payoutPerMinuteWeekly} >= 0`,
    ),
    check(
      "at_voice_ranges_payout_per_minute_long_term_non_negative",
      sql`${t.payoutPerMinuteLongTerm} >= 0`,
    ),
    check(
      "at_voice_ranges_carrier_billing_cycle_days_positive",
      sql`${t.carrierBillingCycleDays} > 0`,
    ),
    check(
      "at_voice_ranges_carrier_payment_terms_days_positive",
      sql`${t.carrierPaymentTermsDays} > 0`,
    ),
    check(
      "at_voice_ranges_payout_billing_cycle_days_positive",
      sql`${t.payoutBillingCycleDays} > 0`,
    ),
    check(
      "at_voice_ranges_payout_payment_terms_days_positive",
      sql`${t.payoutPaymentTermsDays} > 0`,
    ),
    check(
      "at_voice_ranges_max_daily_total_minutes_positive",
      sql`${t.maxDailyTotalMinutes} IS NULL OR ${t.maxDailyTotalMinutes} > 0`,
    ),
    check(
      "at_voice_ranges_max_daily_minutes_a_number_positive",
      sql`${t.maxDailyMinutesANumber} IS NULL OR ${t.maxDailyMinutesANumber} > 0`,
    ),
    check(
      "at_voice_ranges_max_daily_minutes_b_number_positive",
      sql`${t.maxDailyMinutesBNumber} IS NULL OR ${t.maxDailyMinutesBNumber} > 0`,
    ),
    check(
      "at_voice_ranges_max_daily_minutes_a_to_b_number_positive",
      sql`${t.maxDailyMinutesAToBNumber} IS NULL OR ${t.maxDailyMinutesAToBNumber} > 0`,
    ),
    check(
      "at_voice_ranges_max_call_duration_minutes_positive",
      sql`${t.maxCallDurationMinutes} IS NULL OR ${t.maxCallDurationMinutes} > 0`,
    ),
    check(
      "at_voice_ranges_target_acd_minutes_positive",
      sql`${t.targetAcdMinutes} IS NULL OR ${t.targetAcdMinutes} > 0`,
    ),
    check(
      "at_voice_ranges_target_asr_percent_range",
      sql`${t.targetAsrPercent} IS NULL OR (${t.targetAsrPercent} >= 0 AND ${t.targetAsrPercent} <= 100)`,
    ),
    check(
      "at_voice_ranges_max_a_number_concurrent_calls_positive",
      sql`${t.maxANumberConcurrentCalls} IS NULL OR ${t.maxANumberConcurrentCalls} > 0`,
    ),
    check(
      "at_voice_ranges_max_b_number_concurrent_calls_positive",
      sql`${t.maxBNumberConcurrentCalls} IS NULL OR ${t.maxBNumberConcurrentCalls} > 0`,
    ),
    check(
      "at_voice_ranges_max_a_to_b_number_concurrent_calls_positive",
      sql`${t.maxAToBNumberConcurrentCalls} IS NULL OR ${t.maxAToBNumberConcurrentCalls} > 0`,
    ),
    index("at_voice_ranges_carrier_idx").on(t.carrierId),
    index("at_voice_ranges_voice_numbering_plan_destination_idx").on(
      t.voiceNumberingPlanDestinationId,
    ),
    index("at_voice_ranges_status_idx").on(t.status),
    index("at_voice_ranges_country_iso2_idx").on(t.countryIso2),
    index("at_voice_ranges_deleted_at_idx").on(t.deletedAt),
  ],
);

export type AtVoiceRangeRow = typeof atVoiceRanges.$inferSelect;
export type NewAtVoiceRangeRow = typeof atVoiceRanges.$inferInsert;

export const atVoiceRangesRelations = relations(
  atVoiceRanges,
  ({ one, many }) => ({
    carrier: one(carriers, {
      fields: [atVoiceRanges.carrierId],
      references: [carriers.id],
    }),
    voiceNumberingPlanDestination: one(voiceNumberingPlanDestinations, {
      fields: [atVoiceRanges.voiceNumberingPlanDestinationId],
      references: [voiceNumberingPlanDestinations.id],
    }),
    atVoiceNumbers: many(atVoiceNumbers),
    rangeUsers: many(atRangeUsers),
    blockedPrefixes: many(atVoiceRangeBlockedPrefixes),
  }),
);

export const atVoiceNumbers = pgTable(
  "at_voice_numbers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    atVoiceRangeId: uuid("at_voice_range_id").notNull(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
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
    index("at_voice_numbers_at_voice_range_idx").on(
      t.atVoiceRangeId,
    ),
    index("at_voice_numbers_user_idx").on(t.userId),
    index("at_voice_numbers_last_success_idx").on(t.lastSuccessfulAttemptAt),
    index("at_voice_numbers_deleted_at_idx").on(t.deletedAt),
    foreignKey({
      name: "at_voice_numbers_at_voice_range_id_fk",
      columns: [t.atVoiceRangeId],
      foreignColumns: [atVoiceRanges.id],
    }).onDelete("cascade"),
  ],
);

export type AtVoiceNumberRow = typeof atVoiceNumbers.$inferSelect;
export type NewAtVoiceNumberRow = typeof atVoiceNumbers.$inferInsert;

export const atVoiceNumbersRelations = relations(atVoiceNumbers, ({ one }) => ({
  range: one(atVoiceRanges, {
    fields: [atVoiceNumbers.atVoiceRangeId],
    references: [atVoiceRanges.id],
  }),
  user: one(users, {
    fields: [atVoiceNumbers.userId],
    references: [users.id],
  }),
}));

export const atRangeUsers = pgTable(
  "at_range_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    atVoiceRangeId: uuid("at_voice_range_id")
      .notNull()
      .references(() => atVoiceRanges.id, { onDelete: "cascade" }),
    idleRevokeHours: integer("idle_revoke_hours").notNull(),
    assignedNumbersCount: integer("assigned_numbers_count")
      .notNull()
      .default(0),
    maxAssignedNumbers: integer("max_assigned_numbers").notNull().default(10),
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
    uniqueIndex("at_range_users_user_range_unique_active")
      .on(t.userId, t.atVoiceRangeId)
      .where(sql`${t.deletedAt} IS NULL`),
    check(
      "at_range_users_idle_revoke_hours_positive",
      sql`${t.idleRevokeHours} > 0`,
    ),
    check(
      "at_range_users_max_assigned_numbers_positive",
      sql`${t.maxAssignedNumbers} > 0`,
    ),
    check(
      "at_range_users_assigned_count_nonneg",
      sql`${t.assignedNumbersCount} >= 0`,
    ),
    check(
      "at_range_users_count_within_max",
      sql`${t.assignedNumbersCount} <= ${t.maxAssignedNumbers}`,
    ),
    index("at_range_users_user_idx").on(t.userId),
    index("at_range_users_range_idx").on(t.atVoiceRangeId),
    index("at_range_users_deleted_at_idx").on(t.deletedAt),
  ],
);

export type AtRangeUserRow = typeof atRangeUsers.$inferSelect;
export type NewAtRangeUserRow = typeof atRangeUsers.$inferInsert;

export const atRangeUsersRelations = relations(
  atRangeUsers,
  ({ one }) => ({
    user: one(users, {
      fields: [atRangeUsers.userId],
      references: [users.id],
    }),
    range: one(atVoiceRanges, {
      fields: [atRangeUsers.atVoiceRangeId],
      references: [atVoiceRanges.id],
    }),
  }),
);

export const voiceBlockedNumberParty = pgEnum("voice_blocked_number_party", [
  "a",
  "b",
]);
export type VoiceBlockedNumberParty =
  (typeof voiceBlockedNumberParty.enumValues)[number];

export const atVoiceRangeBlockedPrefixes = pgTable(
  "at_voice_range_blocked_prefixes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    atVoiceRangeId: uuid("at_voice_range_id").references(
      () => atVoiceRanges.id,
      { onDelete: "cascade" },
    ),
    party: voiceBlockedNumberParty("party").notNull(),
    prefix: text("prefix").notNull(),
    reason: text("reason"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
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
      "at_voice_range_blocked_prefixes_scoped_unique_active",
    )
      .on(t.atVoiceRangeId, t.party, t.prefix)
      .where(
        sql`${t.deletedAt} IS NULL AND ${t.atVoiceRangeId} IS NOT NULL`,
      ),
    uniqueIndex(
      "at_voice_range_blocked_prefixes_global_unique_active",
    )
      .on(t.party, t.prefix)
      .where(
        sql`${t.deletedAt} IS NULL AND ${t.atVoiceRangeId} IS NULL`,
      ),
    check(
      "at_voice_range_blocked_prefixes_prefix_digits",
      sql`${t.prefix} ~ '^[0-9]+$'`,
    ),
    check(
      "at_voice_range_blocked_prefixes_expires_after_created",
      sql`${t.expiresAt} IS NULL OR ${t.expiresAt} > ${t.createdAt}`,
    ),
    index("at_voice_range_blocked_prefixes_range_idx").on(
      t.atVoiceRangeId,
    ),
    index("at_voice_range_blocked_prefixes_party_prefix_idx").on(
      t.party,
      t.prefix,
    ),
    index("at_voice_range_blocked_prefixes_expires_at_idx").on(
      t.expiresAt,
    ),
    index("at_voice_range_blocked_prefixes_deleted_at_idx").on(
      t.deletedAt,
    ),
  ],
);

export type AtVoiceRangeBlockedPrefixRow =
  typeof atVoiceRangeBlockedPrefixes.$inferSelect;
export type NewAtVoiceRangeBlockedPrefixRow =
  typeof atVoiceRangeBlockedPrefixes.$inferInsert;

export const atVoiceRangeBlockedPrefixesRelations = relations(
  atVoiceRangeBlockedPrefixes,
  ({ one }) => ({
    range: one(atVoiceRanges, {
      fields: [atVoiceRangeBlockedPrefixes.atVoiceRangeId],
      references: [atVoiceRanges.id],
    }),
  }),
);

export const carriersRelations = relations(carriers, ({ many }) => ({
  atVoiceRanges: many(atVoiceRanges),
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
export type VoiceTrunkProtocol = (typeof voiceTrunkProtocol.enumValues)[number];

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
export type VoiceTrunkAuthType = (typeof voiceTrunkAuthType.enumValues)[number];

export const voiceTrunkDtmfMode = pgEnum("voice_trunk_dtmf_mode", [
  "rfc2833",
  "inband",
  "info",
]);
export type VoiceTrunkDtmfMode = (typeof voiceTrunkDtmfMode.enumValues)[number];

export const voiceTrunkNatMode = pgEnum("voice_trunk_nat_mode", [
  "no",
  "yes",
  "force_rport",
  "comedia",
]);
export type VoiceTrunkNatMode = (typeof voiceTrunkNatMode.enumValues)[number];

export const voiceTrunks = pgTable(
  "voice_trunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    carrierId: uuid("carrier_id")
      .notNull()
      .references(() => carriers.id, { onDelete: "cascade" }),
    voiceRateSheetId: uuid("voice_rate_sheet_id").references(
      () => voiceRateSheets.id,
      { onDelete: "restrict" },
    ),
    name: text("name").notNull(),
    status: voiceTrunkStatus("status").notNull().default("active"),
    direction: voiceTrunkDirection("direction").notNull().default("both"),
    protocol: voiceTrunkProtocol("protocol").notNull().default("sip"),
    transport: voiceTrunkTransport("transport").notNull().default("udp"),
    authType: voiceTrunkAuthType("auth_type").notNull(),
    username: text("username"),
    passwordEncrypted: text("password_encrypted"),
    realm: text("realm"),
    fromUser: text("from_user"),
    fromDomain: text("from_domain"),
    registerEnabled: boolean("register_enabled").notNull().default(false),
    proxy: text("proxy"),
    expiresSeconds: integer("expires_seconds"),
    qualifySeconds: integer("qualify_seconds"),
    maxChannels: integer("max_channels"),
    cpsLimit: integer("cps_limit"),
    maxCallDurationSeconds: integer("max_call_duration_seconds"),
    capacityLines: integer("capacity_lines"),
    rtpTimeoutSeconds: integer("rtp_timeout_seconds"),
    codecs: jsonb("codecs")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    dtmfMode: voiceTrunkDtmfMode("dtmf_mode").notNull().default("rfc2833"),
    natMode: voiceTrunkNatMode("nat_mode").notNull().default("no"),
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
    index("voice_trunks_voice_rate_sheet_idx").on(t.voiceRateSheetId),
    index("voice_trunks_status_idx").on(t.status),
    index("voice_trunks_deleted_at_idx").on(t.deletedAt),
    check(
      "voice_trunks_auth_userpass_complete",
      sql`${t.authType} NOT IN ('userpass','both') OR (${t.username} IS NOT NULL AND ${t.passwordEncrypted} IS NOT NULL)`,
    ),
    check(
      "voice_trunks_max_channels_positive",
      sql`${t.maxChannels} IS NULL OR ${t.maxChannels} > 0`,
    ),
    check(
      "voice_trunks_cps_limit_positive",
      sql`${t.cpsLimit} IS NULL OR ${t.cpsLimit} > 0`,
    ),
    check(
      "voice_trunks_max_call_duration_positive",
      sql`${t.maxCallDurationSeconds} IS NULL OR ${t.maxCallDurationSeconds} > 0`,
    ),
    check(
      "voice_trunks_capacity_lines_positive",
      sql`${t.capacityLines} IS NULL OR ${t.capacityLines} > 0`,
    ),
    check(
      "voice_trunks_rtp_timeout_positive",
      sql`${t.rtpTimeoutSeconds} IS NULL OR ${t.rtpTimeoutSeconds} > 0`,
    ),
  ],
);

export type VoiceTrunkRow = typeof voiceTrunks.$inferSelect;
export type NewVoiceTrunkRow = typeof voiceTrunks.$inferInsert;

export const voiceTrunksRelations = relations(voiceTrunks, ({ one, many }) => ({
  carrier: one(carriers, {
    fields: [voiceTrunks.carrierId],
    references: [carriers.id],
  }),
  voiceRateSheet: one(voiceRateSheets, {
    fields: [voiceTrunks.voiceRateSheetId],
    references: [voiceRateSheets.id],
  }),
  ips: many(voiceTrunkIps),
  blockedPrefixes: many(voiceTrunkBlockedPrefixes),
}));

export const voiceTrunkIpStatus = pgEnum("voice_trunk_ip_status", [
  "active",
  "inactive",
]);
export type VoiceTrunkIpStatus = (typeof voiceTrunkIpStatus.enumValues)[number];

export const voiceTrunkIps = pgTable(
  "voice_trunk_ips",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    voiceTrunkId: uuid("voice_trunk_id")
      .notNull()
      .references(() => voiceTrunks.id, { onDelete: "cascade" }),
    ip: text("ip").notNull(),
    prefix: text("prefix"),
    status: voiceTrunkIpStatus("status").notNull().default("active"),
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
    uniqueIndex("voice_trunk_ips_trunk_ip_prefix_unique_active")
      .on(t.voiceTrunkId, t.ip, t.prefix)
      .where(sql`${t.deletedAt} IS NULL`),
    index("voice_trunk_ips_trunk_idx").on(t.voiceTrunkId),
    index("voice_trunk_ips_status_idx").on(t.status),
    index("voice_trunk_ips_deleted_at_idx").on(t.deletedAt),
  ],
);

export type VoiceTrunkIpRow = typeof voiceTrunkIps.$inferSelect;
export type NewVoiceTrunkIpRow = typeof voiceTrunkIps.$inferInsert;

export const voiceTrunkIpsRelations = relations(voiceTrunkIps, ({ one }) => ({
  voiceTrunk: one(voiceTrunks, {
    fields: [voiceTrunkIps.voiceTrunkId],
    references: [voiceTrunks.id],
  }),
}));

export const voiceTrunkBlockedPrefixes = pgTable(
  "voice_trunk_blocked_prefixes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    voiceTrunkId: uuid("voice_trunk_id").references(() => voiceTrunks.id, {
      onDelete: "cascade",
    }),
    party: voiceBlockedNumberParty("party").notNull(),
    prefix: text("prefix").notNull(),
    reason: text("reason"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
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
    uniqueIndex("voice_trunk_blocked_prefixes_scoped_unique_active")
      .on(t.voiceTrunkId, t.party, t.prefix)
      .where(sql`${t.deletedAt} IS NULL AND ${t.voiceTrunkId} IS NOT NULL`),
    uniqueIndex("voice_trunk_blocked_prefixes_global_unique_active")
      .on(t.party, t.prefix)
      .where(sql`${t.deletedAt} IS NULL AND ${t.voiceTrunkId} IS NULL`),
    check(
      "voice_trunk_blocked_prefixes_prefix_digits",
      sql`${t.prefix} ~ '^[0-9]+$'`,
    ),
    check(
      "voice_trunk_blocked_prefixes_expires_after_created",
      sql`${t.expiresAt} IS NULL OR ${t.expiresAt} > ${t.createdAt}`,
    ),
    index("voice_trunk_blocked_prefixes_trunk_idx").on(t.voiceTrunkId),
    index("voice_trunk_blocked_prefixes_party_prefix_idx").on(
      t.party,
      t.prefix,
    ),
    index("voice_trunk_blocked_prefixes_expires_at_idx").on(t.expiresAt),
    index("voice_trunk_blocked_prefixes_deleted_at_idx").on(t.deletedAt),
  ],
);

export type VoiceTrunkBlockedPrefixRow =
  typeof voiceTrunkBlockedPrefixes.$inferSelect;
export type NewVoiceTrunkBlockedPrefixRow =
  typeof voiceTrunkBlockedPrefixes.$inferInsert;

export const voiceTrunkBlockedPrefixesRelations = relations(
  voiceTrunkBlockedPrefixes,
  ({ one }) => ({
    voiceTrunk: one(voiceTrunks, {
      fields: [voiceTrunkBlockedPrefixes.voiceTrunkId],
      references: [voiceTrunks.id],
    }),
  }),
);

export const voiceNumberingPlanStatus = pgEnum("voice_numbering_plan_status", [
  "active",
  "inactive",
]);
export type VoiceNumberingPlanStatus =
  (typeof voiceNumberingPlanStatus.enumValues)[number];

export const voiceNumberingPlanDestinationType = pgEnum(
  "voice_numbering_plan_destination_type",
  [
    "all",
    "landline",
    "mobile",
    "premium",
    "special",
    "toll_free",
    "shared_cost",
    "satellite",
    "personal",
    "paging",
    "voip",
    "ngn",
  ],
);
export type VoiceNumberingPlanDestinationType =
  (typeof voiceNumberingPlanDestinationType.enumValues)[number];

export const voiceNumberingPlans = pgTable(
  "voice_numbering_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    status: voiceNumberingPlanStatus("status").notNull().default("active"),
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
    uniqueIndex("voice_numbering_plans_name_unique_active")
      .on(t.name)
      .where(sql`${t.deletedAt} IS NULL`),
    index("voice_numbering_plans_status_idx").on(t.status),
    index("voice_numbering_plans_deleted_at_idx").on(t.deletedAt),
  ],
);

export type VoiceNumberingPlanRow = typeof voiceNumberingPlans.$inferSelect;
export type NewVoiceNumberingPlanRow = typeof voiceNumberingPlans.$inferInsert;

export const voiceNumberingPlansRelations = relations(
  voiceNumberingPlans,
  ({ many }) => ({
    destinations: many(voiceNumberingPlanDestinations),
  }),
);

export const countries = pgTable(
  "countries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    iso2: text("iso2").notNull(),
    nameEn: text("name_en").notNull(),
    nameIt: text("name_it").notNull(),
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
    uniqueIndex("countries_iso2_unique_active")
      .on(t.iso2)
      .where(sql`${t.deletedAt} IS NULL`),
    index("countries_iso2_idx").on(t.iso2),
    index("countries_deleted_at_idx").on(t.deletedAt),
    check("countries_iso2_format", sql`${t.iso2} ~ '^[A-Z]{2}$'`),
  ],
);

export type CountryRow = typeof countries.$inferSelect;
export type NewCountryRow = typeof countries.$inferInsert;

export const voiceNumberingPlanDestinations = pgTable(
  "voice_numbering_plan_destinations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    voiceNumberingPlanId: uuid("voice_numbering_plan_id")
      .notNull()
      .references(() => voiceNumberingPlans.id, { onDelete: "cascade" }),
    countryIso2: text("country_iso2").notNull(),
    name: text("name").notNull(),
    type: voiceNumberingPlanDestinationType("type"),
    website: text("website"),
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
      "voice_numbering_plan_destinations_plan_country_name_unique_active",
    )
      .on(t.voiceNumberingPlanId, t.countryIso2, t.name)
      .where(sql`${t.deletedAt} IS NULL`),
    index("voice_numbering_plan_destinations_plan_idx").on(
      t.voiceNumberingPlanId,
    ),
    index("voice_numbering_plan_destinations_country_iso2_idx").on(
      t.countryIso2,
    ),
    index("voice_numbering_plan_destinations_deleted_at_idx").on(t.deletedAt),
    check(
      "voice_numbering_plan_destinations_country_iso2_format",
      sql`${t.countryIso2} ~ '^[A-Z]{2}$'`,
    ),
    check(
      "voice_numbering_plan_destinations_min_digits_positive",
      sql`${t.minDigits} > 0`,
    ),
    check(
      "voice_numbering_plan_destinations_max_digits_positive",
      sql`${t.maxDigits} > 0`,
    ),
    check(
      "voice_numbering_plan_destinations_digits_range",
      sql`${t.minDigits} <= ${t.maxDigits}`,
    ),
  ],
);

export type VoiceNumberingPlanDestinationRow =
  typeof voiceNumberingPlanDestinations.$inferSelect;
export type NewVoiceNumberingPlanDestinationRow =
  typeof voiceNumberingPlanDestinations.$inferInsert;

export const voiceNumberingPlanDestinationsRelations = relations(
  voiceNumberingPlanDestinations,
  ({ many, one }) => ({
    plan: one(voiceNumberingPlans, {
      fields: [voiceNumberingPlanDestinations.voiceNumberingPlanId],
      references: [voiceNumberingPlans.id],
    }),
    codes: many(voiceNumberingPlanCodes),
  }),
);

export const voiceNumberingPlanCodes = pgTable(
  "voice_numbering_plan_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    voiceNumberingPlanDestinationId: uuid("voice_numbering_plan_destination_id")
      .notNull()
      .references(() => voiceNumberingPlanDestinations.id, {
        onDelete: "cascade",
      }),
    fullCode: text("full_code").notNull(),
    countryCode: text("country_code").notNull(),
    destinationCode: text("destination_code"),
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
      "voice_numbering_plan_codes_destination_full_code_unique_active",
    )
      .on(t.voiceNumberingPlanDestinationId, t.fullCode)
      .where(sql`${t.deletedAt} IS NULL`),
    index("voice_numbering_plan_codes_destination_idx").on(
      t.voiceNumberingPlanDestinationId,
    ),
    index("voice_numbering_plan_codes_full_code_idx").on(t.fullCode),
    index("voice_numbering_plan_codes_country_code_idx").on(t.countryCode),
    index("voice_numbering_plan_codes_destination_code_idx").on(
      t.destinationCode,
    ),
    index("voice_numbering_plan_codes_deleted_at_idx").on(t.deletedAt),
    check(
      "voice_numbering_plan_codes_full_code_digits",
      sql`${t.fullCode} ~ '^[0-9]+$'`,
    ),
    check(
      "voice_numbering_plan_codes_country_code_digits",
      sql`${t.countryCode} ~ '^[0-9]+$'`,
    ),
  ],
);

export type VoiceNumberingPlanCodeRow =
  typeof voiceNumberingPlanCodes.$inferSelect;
export type NewVoiceNumberingPlanCodeRow =
  typeof voiceNumberingPlanCodes.$inferInsert;

export const voiceNumberingPlanCodesRelations = relations(
  voiceNumberingPlanCodes,
  ({ one }) => ({
    destination: one(voiceNumberingPlanDestinations, {
      fields: [voiceNumberingPlanCodes.voiceNumberingPlanDestinationId],
      references: [voiceNumberingPlanDestinations.id],
    }),
  }),
);

export const voiceCdrs = pgTable(
  "voice_cdrs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    durationSeconds: integer("duration_seconds").notNull(),
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
    check("voice_cdrs_duration_non_negative", sql`${t.durationSeconds} >= 0`),
    check(
      "voice_cdrs_ended_after_started",
      sql`${t.endedAt} IS NULL OR ${t.endedAt} >= ${t.startedAt}`,
    ),
  ],
);

export type VoiceCdrRow = typeof voiceCdrs.$inferSelect;
export type NewVoiceCdrRow = typeof voiceCdrs.$inferInsert;

export const voiceRateSheetStatus = pgEnum("voice_rate_sheet_status", [
  "active",
  "inactive",
]);
export type VoiceRateSheetStatus =
  (typeof voiceRateSheetStatus.enumValues)[number];

export const voiceRateSheets = pgTable(
  "voice_rate_sheets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    status: voiceRateSheetStatus("status").notNull().default("active"),
    voiceNumberingPlanId: uuid("voice_numbering_plan_id")
      .notNull()
      .references(() => voiceNumberingPlans.id, { onDelete: "restrict" }),
    currency: currency("currency").notNull(),
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
    uniqueIndex("voice_rate_sheets_name_unique_active")
      .on(t.name)
      .where(sql`${t.deletedAt} IS NULL`),
    index("voice_rate_sheets_status_idx").on(t.status),
    index("voice_rate_sheets_voice_numbering_plan_idx").on(
      t.voiceNumberingPlanId,
    ),
    index("voice_rate_sheets_deleted_at_idx").on(t.deletedAt),
  ],
);

export type VoiceRateSheetRow = typeof voiceRateSheets.$inferSelect;
export type NewVoiceRateSheetRow = typeof voiceRateSheets.$inferInsert;

export const voiceRateSheetsRelations = relations(
  voiceRateSheets,
  ({ one, many }) => ({
    voiceNumberingPlan: one(voiceNumberingPlans, {
      fields: [voiceRateSheets.voiceNumberingPlanId],
      references: [voiceNumberingPlans.id],
    }),
    lines: many(voiceRateSheetLines),
  }),
);

export const voiceRateSheetLines = pgTable(
  "voice_rate_sheet_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    voiceRateSheetId: uuid("voice_rate_sheet_id")
      .notNull()
      .references(() => voiceRateSheets.id, { onDelete: "cascade" }),
    voiceNumberingPlanDestinationId: uuid("voice_numbering_plan_destination_id")
      .notNull()
      .references(() => voiceNumberingPlanDestinations.id, {
        onDelete: "restrict",
      }),
    minDurationSeconds: integer("min_duration_seconds").notNull(),
    incrementSeconds: integer("increment_seconds").notNull(),
    setupFee: numeric("setup_fee", { precision: 18, scale: 6 }),
    ratePerMinute: numeric("rate_per_minute", { precision: 18, scale: 6 }).notNull(),
    validFrom: timestamp("valid_from", { withTimezone: true })
      .notNull()
      .defaultNow(),
    validTo: timestamp("valid_to", { withTimezone: true }),
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
    index("voice_rate_sheet_lines_voice_rate_sheet_idx").on(t.voiceRateSheetId),
    index("voice_rate_sheet_lines_destination_idx").on(
      t.voiceNumberingPlanDestinationId,
    ),
    index("voice_rate_sheet_lines_valid_from_idx").on(t.validFrom),
    index("voice_rate_sheet_lines_valid_to_idx").on(t.validTo),
    index("voice_rate_sheet_lines_deleted_at_idx").on(t.deletedAt),
    check(
      "voice_rate_sheet_lines_rate_per_minute_non_negative",
      sql`${t.ratePerMinute} >= 0`,
    ),
    check(
      "voice_rate_sheet_lines_setup_fee_non_negative",
      sql`${t.setupFee} IS NULL OR ${t.setupFee} >= 0`,
    ),
    check(
      "voice_rate_sheet_lines_min_duration_non_negative",
      sql`${t.minDurationSeconds} >= 0`,
    ),
    check(
      "voice_rate_sheet_lines_increment_positive",
      sql`${t.incrementSeconds} > 0`,
    ),
    check(
      "voice_rate_sheet_lines_valid_range",
      sql`${t.validTo} IS NULL OR ${t.validTo} > ${t.validFrom}`,
    ),
  ],
);

export type VoiceRateSheetLineRow = typeof voiceRateSheetLines.$inferSelect;
export type NewVoiceRateSheetLineRow = typeof voiceRateSheetLines.$inferInsert;

export const voiceRateSheetLinesRelations = relations(
  voiceRateSheetLines,
  ({ one }) => ({
    voiceRateSheet: one(voiceRateSheets, {
      fields: [voiceRateSheetLines.voiceRateSheetId],
      references: [voiceRateSheets.id],
    }),
    destination: one(voiceNumberingPlanDestinations, {
      fields: [voiceRateSheetLines.voiceNumberingPlanDestinationId],
      references: [voiceNumberingPlanDestinations.id],
    }),
  }),
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type RoleRow = typeof roles.$inferSelect;
export type NewRoleRow = typeof roles.$inferInsert;
export type PermissionRow = typeof permissions.$inferSelect;
export type NewPermissionRow = typeof permissions.$inferInsert;
export type UserRoleRow = typeof userRoles.$inferSelect;
export type RolePermissionRow = typeof rolePermissions.$inferSelect;
