import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  primaryKey,
  index,
  uniqueIndex,
  jsonb,
  check,
  integer,
  boolean,
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
    email: text("email").notNull(),
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
    ratesEmail: text("rates_email").notNull(),
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

export const terminationStatus = pgEnum("termination_status", [
  "active",
  "inactive",
]);
export type TerminationStatus = (typeof terminationStatus.enumValues)[number];

export const currency = pgEnum("currency", ["usd", "eur", "gbp"]);
export type Currency = (typeof currency.enumValues)[number];

export const terminations = pgTable(
  "terminations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    status: terminationStatus("status").notNull().default("active"),
    carrierId: uuid("carrier_id")
      .notNull()
      .references(() => carriers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    internalRouteName: text("internal_route_name").notNull(),
    carrierRouteName: text("carrier_route_name").notNull(),
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
    uniqueIndex("terminations_carrier_internal_unique_active")
      .on(t.carrierId, t.internalRouteName)
      .where(sql`${t.deletedAt} IS NULL`),
    check(
      "terminations_country_code_iso2",
      sql`${t.countryCode} ~ '^[A-Z]{2}$'`,
    ),
    index("terminations_carrier_idx").on(t.carrierId),
    index("terminations_status_idx").on(t.status),
    index("terminations_country_idx").on(t.countryCode),
    index("terminations_deleted_at_idx").on(t.deletedAt),
  ],
);

export type TerminationRow = typeof terminations.$inferSelect;
export type NewTerminationRow = typeof terminations.$inferInsert;

export const terminationsRelations = relations(terminations, ({ one, many }) => ({
  carrier: one(carriers, {
    fields: [terminations.carrierId],
    references: [carriers.id],
  }),
  dids: many(dids),
}));

export const dids = pgTable(
  "dids",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    terminationId: uuid("termination_id")
      .notNull()
      .references(() => terminations.id, { onDelete: "cascade" }),
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
    uniqueIndex("dids_number_unique_active")
      .on(t.number)
      .where(sql`${t.deletedAt} IS NULL`),
    index("dids_termination_idx").on(t.terminationId),
    index("dids_last_success_idx").on(t.lastSuccessfulAttemptAt),
    index("dids_deleted_at_idx").on(t.deletedAt),
  ],
);

export type DidRow = typeof dids.$inferSelect;
export type NewDidRow = typeof dids.$inferInsert;

export const didsRelations = relations(dids, ({ one }) => ({
  termination: one(terminations, {
    fields: [dids.terminationId],
    references: [terminations.id],
  }),
}));

export const carriersRelations = relations(carriers, ({ many }) => ({
  terminations: many(terminations),
  chatContacts: many(chatContacts),
  trunks: many(trunks),
}));

export const trunkStatus = pgEnum("trunk_status", [
  "active",
  "inactive",
  "testing",
]);
export type TrunkStatus = (typeof trunkStatus.enumValues)[number];

export const trunkDirection = pgEnum("trunk_direction", [
  "inbound",
  "outbound",
  "both",
]);
export type TrunkDirection = (typeof trunkDirection.enumValues)[number];

export const trunkProtocol = pgEnum("trunk_protocol", ["sip", "sips"]);
export type TrunkProtocol = (typeof trunkProtocol.enumValues)[number];

export const trunkTransport = pgEnum("trunk_transport", ["udp", "tcp", "tls"]);
export type TrunkTransport = (typeof trunkTransport.enumValues)[number];

export const trunkAuthType = pgEnum("trunk_auth_type", [
  "ip",
  "userpass",
  "both",
]);
export type TrunkAuthType = (typeof trunkAuthType.enumValues)[number];

export const trunkDtmfMode = pgEnum("trunk_dtmf_mode", [
  "rfc2833",
  "inband",
  "info",
]);
export type TrunkDtmfMode = (typeof trunkDtmfMode.enumValues)[number];

export const trunkNatMode = pgEnum("trunk_nat_mode", [
  "no",
  "yes",
  "force_rport",
  "comedia",
]);
export type TrunkNatMode = (typeof trunkNatMode.enumValues)[number];

export const trunks = pgTable(
  "trunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    carrierId: uuid("carrier_id")
      .notNull()
      .references(() => carriers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    status: trunkStatus("status").notNull().default("active"),
    direction: trunkDirection("direction").notNull().default("both"),
    protocol: trunkProtocol("protocol").notNull().default("sip"),
    transport: trunkTransport("transport").notNull().default("udp"),
    host: text("host").notNull(),
    port: integer("port").notNull().default(5060),
    authType: trunkAuthType("auth_type").notNull(),
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
    dtmfMode: trunkDtmfMode("dtmf_mode").notNull().default("rfc2833"),
    natMode: trunkNatMode("nat_mode").notNull().default("no"),
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
    uniqueIndex("trunks_carrier_name_unique_active")
      .on(t.carrierId, t.name)
      .where(sql`${t.deletedAt} IS NULL`),
    index("trunks_carrier_idx").on(t.carrierId),
    index("trunks_status_idx").on(t.status),
    index("trunks_deleted_at_idx").on(t.deletedAt),
    check("trunks_port_range", sql`${t.port} BETWEEN 1 AND 65535`),
    check(
      "trunks_auth_userpass_complete",
      sql`${t.authType} NOT IN ('userpass','both') OR (${t.username} IS NOT NULL AND ${t.passwordEncrypted} IS NOT NULL)`,
    ),
    check(
      "trunks_auth_ip_complete",
      sql`${t.authType} NOT IN ('ip','both') OR (${t.ipAcl} IS NOT NULL AND jsonb_array_length(${t.ipAcl}) > 0)`,
    ),
    check(
      "trunks_max_channels_positive",
      sql`${t.maxChannels} IS NULL OR ${t.maxChannels} > 0`,
    ),
    check(
      "trunks_cps_limit_positive",
      sql`${t.cpsLimit} IS NULL OR ${t.cpsLimit} > 0`,
    ),
  ],
);

export type TrunkRow = typeof trunks.$inferSelect;
export type NewTrunkRow = typeof trunks.$inferInsert;

export const trunksRelations = relations(trunks, ({ one }) => ({
  carrier: one(carriers, {
    fields: [trunks.carrierId],
    references: [carriers.id],
  }),
}));

export const numberingPlan = pgTable(
  "numbering_plan",
  {
    id: uuid("id").primaryKey().defaultRandom(),
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
    uniqueIndex("numbering_plan_country_area_operator_unique_active")
      .on(t.countryCode, t.areaCode, t.operatorName)
      .where(sql`${t.deletedAt} IS NULL`),
    index("numbering_plan_country_idx").on(t.countryCode),
    index("numbering_plan_country_area_idx").on(t.countryCode, t.areaCode),
    index("numbering_plan_deleted_at_idx").on(t.deletedAt),
    check(
      "numbering_plan_country_code_iso2",
      sql`${t.countryCode} ~ '^[A-Z]{2}$'`,
    ),
    check("numbering_plan_min_digits_positive", sql`${t.minDigits} > 0`),
    check("numbering_plan_max_digits_positive", sql`${t.maxDigits} > 0`),
    check(
      "numbering_plan_digits_range",
      sql`${t.minDigits} <= ${t.maxDigits}`,
    ),
  ],
);

export type NumberingPlanRow = typeof numberingPlan.$inferSelect;
export type NewNumberingPlanRow = typeof numberingPlan.$inferInsert;

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type RoleRow = typeof roles.$inferSelect;
export type NewRoleRow = typeof roles.$inferInsert;
export type PermissionRow = typeof permissions.$inferSelect;
export type NewPermissionRow = typeof permissions.$inferInsert;
export type UserRoleRow = typeof userRoles.$inferSelect;
export type RolePermissionRow = typeof rolePermissions.$inferSelect;
