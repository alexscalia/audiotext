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

export const TrunkStatusEnum = z.enum(["active", "inactive", "testing"]);
export type TrunkStatus = z.infer<typeof TrunkStatusEnum>;

export const TrunkDirectionEnum = z.enum(["inbound", "outbound", "both"]);
export type TrunkDirection = z.infer<typeof TrunkDirectionEnum>;

export const TrunkProtocolEnum = z.enum(["sip", "sips"]);
export type TrunkProtocol = z.infer<typeof TrunkProtocolEnum>;

export const TrunkTransportEnum = z.enum(["udp", "tcp", "tls"]);
export type TrunkTransport = z.infer<typeof TrunkTransportEnum>;

export const TrunkAuthTypeEnum = z.enum(["ip", "userpass", "both"]);
export type TrunkAuthType = z.infer<typeof TrunkAuthTypeEnum>;

export const TrunkDtmfModeEnum = z.enum(["rfc2833", "inband", "info"]);
export type TrunkDtmfMode = z.infer<typeof TrunkDtmfModeEnum>;

export const TrunkNatModeEnum = z.enum(["no", "yes", "force_rport", "comedia"]);
export type TrunkNatMode = z.infer<typeof TrunkNatModeEnum>;

export const IpOrCidr = z
  .string()
  .min(2)
  .max(64)
  .regex(
    /^([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}(\/(3[0-2]|[12]?[0-9]))?|[0-9a-fA-F:]+(\/(1[01][0-9]|12[0-8]|[1-9]?[0-9]))?)$/,
    "IPv4/IPv6 address or CIDR",
  );
export type IpOrCidr = z.infer<typeof IpOrCidr>;

export const CodecCode = z
  .string()
  .min(2)
  .max(16)
  .regex(/^[a-z0-9]+$/, "lowercase alphanumeric");
export type CodecCode = z.infer<typeof CodecCode>;

export const Port = z.number().int().min(1).max(65535);
export const PositiveInt = z.number().int().positive();

const trunkBaseFields = {
  carrierId: z.string().uuid(),
  name: z.string().min(1).max(128),
  status: TrunkStatusEnum.default("active"),
  direction: TrunkDirectionEnum.default("both"),
  protocol: TrunkProtocolEnum.default("sip"),
  transport: TrunkTransportEnum.default("udp"),
  host: z.string().min(1).max(255),
  port: Port.default(5060),
  realm: z.string().max(255).optional(),
  fromUser: z.string().max(128).optional(),
  fromDomain: z.string().max(255).optional(),
  register: z.boolean().default(false),
  proxy: z.string().max(255).optional(),
  expiresSeconds: PositiveInt.optional(),
  qualifySeconds: PositiveInt.optional(),
  maxChannels: PositiveInt.optional(),
  cpsLimit: PositiveInt.optional(),
  codecs: z.array(CodecCode).default([]),
  dtmfMode: TrunkDtmfModeEnum.default("rfc2833"),
  natMode: TrunkNatModeEnum.default("no"),
  metadata: z.record(z.string(), z.unknown()).optional(),
};

export const TrunkSchema = z.object({
  id: z.string().uuid(),
  carrierId: z.string().uuid(),
  name: z.string(),
  status: TrunkStatusEnum,
  direction: TrunkDirectionEnum,
  protocol: TrunkProtocolEnum,
  transport: TrunkTransportEnum,
  host: z.string(),
  port: Port,
  authType: TrunkAuthTypeEnum,
  username: z.string().nullable(),
  passwordEncrypted: z.string().nullable(),
  realm: z.string().nullable(),
  fromUser: z.string().nullable(),
  fromDomain: z.string().nullable(),
  register: z.boolean(),
  proxy: z.string().nullable(),
  expiresSeconds: z.number().int().nullable(),
  qualifySeconds: z.number().int().nullable(),
  maxChannels: z.number().int().nullable(),
  cpsLimit: z.number().int().nullable(),
  codecs: z.array(CodecCode),
  dtmfMode: TrunkDtmfModeEnum,
  natMode: TrunkNatModeEnum,
  ipAcl: z.array(IpOrCidr).nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});
export type Trunk = z.infer<typeof TrunkSchema>;

export const CreateTrunkInput = z.discriminatedUnion("authType", [
  z.object({
    authType: z.literal("ip"),
    ipAcl: z.array(IpOrCidr).min(1),
    ...trunkBaseFields,
  }),
  z.object({
    authType: z.literal("userpass"),
    username: z.string().min(1).max(128),
    password: z.string().min(1).max(256),
    ...trunkBaseFields,
  }),
  z.object({
    authType: z.literal("both"),
    ipAcl: z.array(IpOrCidr).min(1),
    username: z.string().min(1).max(128),
    password: z.string().min(1).max(256),
    ...trunkBaseFields,
  }),
]);
export type CreateTrunkInput = z.infer<typeof CreateTrunkInput>;

export const UpdateTrunkInput = z.object({
  ...Object.fromEntries(
    Object.entries(trunkBaseFields).map(([k, v]) => [
      k,
      (v as z.ZodType).optional(),
    ]),
  ),
  authType: TrunkAuthTypeEnum.optional(),
  username: z.string().min(1).max(128).nullable().optional(),
  password: z.string().min(1).max(256).optional(),
  ipAcl: z.array(IpOrCidr).min(1).nullable().optional(),
});
export type UpdateTrunkInput = z.infer<typeof UpdateTrunkInput>;

export const DidNumber = z
  .string()
  .min(3)
  .max(32)
  .regex(/^\+?[0-9]+$/, "digits only, optional leading +");

export const DidSchema = z.object({
  id: z.string().uuid(),
  terminationId: z.string().uuid(),
  number: DidNumber,
  lastSuccessfulAttemptAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});
export type Did = z.infer<typeof DidSchema>;

export const CreateDidInput = z.object({
  terminationId: z.string().uuid(),
  number: DidNumber,
});
export type CreateDidInput = z.infer<typeof CreateDidInput>;

export const UpdateDidInput = z.object({
  terminationId: z.string().uuid().optional(),
  number: DidNumber.optional(),
  lastSuccessfulAttemptAt: z.string().datetime().nullable().optional(),
});
export type UpdateDidInput = z.infer<typeof UpdateDidInput>;

export const UserWithRolesSchema = UserSchema.extend({
  roles: z.array(
    RoleSchema.extend({
      permissions: z.array(PermissionSchema),
    }),
  ),
});
export type UserWithRoles = z.infer<typeof UserWithRolesSchema>;
