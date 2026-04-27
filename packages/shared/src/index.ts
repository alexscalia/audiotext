import { z } from "zod";

export const HealthSchema = z.object({
  ok: z.boolean(),
  ts: z.string().datetime(),
});
export type Health = z.infer<typeof HealthSchema>;

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});
export type User = z.infer<typeof UserSchema>;

export const CreateUserInput = z.object({
  email: z.string().email(),
});
export type CreateUserInput = z.infer<typeof CreateUserInput>;

export const RoleSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(64),
  description: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});
export type Role = z.infer<typeof RoleSchema>;

export const CreateRoleInput = z.object({
  name: z.string().min(1).max(64),
  description: z.string().max(512).optional(),
});
export type CreateRoleInput = z.infer<typeof CreateRoleInput>;

export const PermissionKey = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z0-9_]+(\.[a-z0-9_]+)+$/, "use dot.notation, e.g. transcript.create");

export const PermissionSchema = z.object({
  id: z.string().uuid(),
  key: PermissionKey,
  description: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});
export type Permission = z.infer<typeof PermissionSchema>;

export const CreatePermissionInput = z.object({
  key: PermissionKey,
  description: z.string().max(512).optional(),
});
export type CreatePermissionInput = z.infer<typeof CreatePermissionInput>;

export const AssignRoleInput = z.object({
  userId: z.string().uuid(),
  roleId: z.string().uuid(),
});
export type AssignRoleInput = z.infer<typeof AssignRoleInput>;

export const GrantPermissionInput = z.object({
  roleId: z.string().uuid(),
  permissionId: z.string().uuid(),
});
export type GrantPermissionInput = z.infer<typeof GrantPermissionInput>;

export const CountryCode = z
  .string()
  .length(2)
  .regex(/^[A-Z]{2}$/, "ISO 3166-1 alpha-2");
export type CountryCode = z.infer<typeof CountryCode>;

export const CarrierAddressSchema = z.object({
  line1: z.string().min(1).max(256),
  line2: z.string().max(256).optional(),
  city: z.string().min(1).max(128),
  state: z.string().max(128).optional(),
  postalCode: z.string().min(1).max(32),
  countryCode: CountryCode,
});
export type CarrierAddress = z.infer<typeof CarrierAddressSchema>;

export const CarrierBankSchema = z.object({
  name: z.string().min(1).max(128),
  accountNumber: z.string().min(1).max(64),
  routingNumber: z.string().max(32).optional(),
  iban: z.string().max(34).optional(),
  swift: z.string().max(11).optional(),
});
export type CarrierBank = z.infer<typeof CarrierBankSchema>;

export const CarrierBillingDetailsSchema = z.object({
  address: CarrierAddressSchema,
  taxId: z.string().max(64).optional(),
  paymentTerms: z.string().max(128).optional(),
  bank: CarrierBankSchema.optional(),
  notes: z.string().max(2048).optional(),
});
export type CarrierBillingDetails = z.infer<typeof CarrierBillingDetailsSchema>;

export const CarrierSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(128),
  businessName: z.string().min(1).max(256),
  billingDetails: CarrierBillingDetailsSchema,
  ratesEmail: z.string().email(),
  billingEmail: z.string().email(),
  nocName: z.string().min(1).max(128),
  nocEmail: z.string().email(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});
export type Carrier = z.infer<typeof CarrierSchema>;

export const CreateCarrierInput = z.object({
  name: z.string().min(1).max(128),
  businessName: z.string().min(1).max(256),
  billingDetails: CarrierBillingDetailsSchema,
  ratesEmail: z.string().email(),
  billingEmail: z.string().email(),
  nocName: z.string().min(1).max(128),
  nocEmail: z.string().email(),
});
export type CreateCarrierInput = z.infer<typeof CreateCarrierInput>;

export const UpdateCarrierInput = CreateCarrierInput.partial();
export type UpdateCarrierInput = z.infer<typeof UpdateCarrierInput>;

export const ChatAppEnum = z.enum(["whatsapp", "telegram", "signal"]);
export type ChatApp = z.infer<typeof ChatAppEnum>;

export const ChatOwnerType = z.enum(["user", "carrier"]);
export type ChatOwnerType = z.infer<typeof ChatOwnerType>;

export const ChatContactSchema = z
  .object({
    id: z.string().uuid(),
    userId: z.string().uuid().nullable(),
    carrierId: z.string().uuid().nullable(),
    chatApp: ChatAppEnum,
    chatId: z.string().min(1).max(128),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    deletedAt: z.string().datetime().nullable(),
  })
  .refine(
    (v) =>
      (v.userId === null) !== (v.carrierId === null),
    { message: "exactly one of userId/carrierId must be set" },
  );
export type ChatContact = z.infer<typeof ChatContactSchema>;

const chatContactBase = z.object({
  chatApp: ChatAppEnum,
  chatId: z.string().min(1).max(128),
});

export const CreateChatContactInput = z.discriminatedUnion("ownerType", [
  chatContactBase.extend({
    ownerType: z.literal("user"),
    ownerId: z.string().uuid(),
  }),
  chatContactBase.extend({
    ownerType: z.literal("carrier"),
    ownerId: z.string().uuid(),
  }),
]);
export type CreateChatContactInput = z.infer<typeof CreateChatContactInput>;

export const UpdateChatContactInput = chatContactBase.partial();
export type UpdateChatContactInput = z.infer<typeof UpdateChatContactInput>;

export const TerminationStatusEnum = z.enum(["active", "inactive"]);
export type TerminationStatus = z.infer<typeof TerminationStatusEnum>;

export const CurrencyEnum = z.enum(["usd", "eur", "gbp"]);
export type Currency = z.infer<typeof CurrencyEnum>;

export const TerminationSchema = z.object({
  id: z.string().uuid(),
  status: TerminationStatusEnum,
  carrierId: z.string().uuid(),
  name: z.string().min(1).max(128),
  internalRouteName: z.string().min(1).max(128),
  carrierRouteName: z.string().min(1).max(128),
  currency: CurrencyEnum,
  countryCode: CountryCode,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});
export type Termination = z.infer<typeof TerminationSchema>;

export const CreateTerminationInput = z.object({
  status: TerminationStatusEnum.default("active"),
  carrierId: z.string().uuid(),
  name: z.string().min(1).max(128),
  internalRouteName: z.string().min(1).max(128),
  carrierRouteName: z.string().min(1).max(128),
  currency: CurrencyEnum,
  countryCode: CountryCode,
});
export type CreateTerminationInput = z.infer<typeof CreateTerminationInput>;

export const UpdateTerminationInput = CreateTerminationInput.partial();
export type UpdateTerminationInput = z.infer<typeof UpdateTerminationInput>;

export const UserWithRolesSchema = UserSchema.extend({
  roles: z.array(
    RoleSchema.extend({
      permissions: z.array(PermissionSchema),
    }),
  ),
});
export type UserWithRoles = z.infer<typeof UserWithRolesSchema>;
