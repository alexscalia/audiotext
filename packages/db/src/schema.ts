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

export const terminationsRelations = relations(terminations, ({ one }) => ({
  carrier: one(carriers, {
    fields: [terminations.carrierId],
    references: [carriers.id],
  }),
}));

export const carriersRelations = relations(carriers, ({ many }) => ({
  terminations: many(terminations),
  chatContacts: many(chatContacts),
}));

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type RoleRow = typeof roles.$inferSelect;
export type NewRoleRow = typeof roles.$inferInsert;
export type PermissionRow = typeof permissions.$inferSelect;
export type NewPermissionRow = typeof permissions.$inferInsert;
export type UserRoleRow = typeof userRoles.$inferSelect;
export type RolePermissionRow = typeof rolePermissions.$inferSelect;
