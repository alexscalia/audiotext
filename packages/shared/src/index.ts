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

export const CountryListItemSchema = z.object({
  iso2: CountryCode,
  name: z.string().min(1),
});
export type CountryListItem = z.infer<typeof CountryListItemSchema>;

export const CountryListQuerySchema = z.object({
  locale: z.enum(["en", "it"]).default("en"),
});
export type CountryListQuery = z.infer<typeof CountryListQuerySchema>;

export const CountryListResponseSchema = z.object({
  countries: z.array(CountryListItemSchema),
});
export type CountryListResponse = z.infer<typeof CountryListResponseSchema>;

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

export const CarrierStatusEnum = z.enum(["active", "inactive"]);
export type CarrierStatus = z.infer<typeof CarrierStatusEnum>;

export const CarrierSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(128),
  businessName: z.string().min(1).max(256),
  status: CarrierStatusEnum,
  billingDetails: CarrierBillingDetailsSchema,
  ratesName: z.string().min(1).max(128),
  ratesEmail: z.string().email(),
  ratesPhone: z.string().max(32).nullable(),
  billingName: z.string().min(1).max(128),
  billingEmail: z.string().email(),
  billingPhone: z.string().max(32).nullable(),
  nocName: z.string().min(1).max(128),
  nocEmail: z.string().email(),
  nocPhone: z.string().max(32).nullable(),
  salesName: z.string().min(1).max(128),
  salesEmail: z.string().email(),
  salesPhone: z.string().max(32).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});
export type Carrier = z.infer<typeof CarrierSchema>;

export const CreateCarrierInput = z.object({
  name: z.string().min(1).max(128),
  businessName: z.string().min(1).max(256),
  status: CarrierStatusEnum.default("active"),
  billingDetails: CarrierBillingDetailsSchema,
  ratesName: z.string().min(1).max(128),
  ratesEmail: z.string().email(),
  ratesPhone: z.string().max(32).optional(),
  billingName: z.string().min(1).max(128),
  billingEmail: z.string().email(),
  billingPhone: z.string().max(32).optional(),
  nocName: z.string().min(1).max(128),
  nocEmail: z.string().email(),
  nocPhone: z.string().max(32).optional(),
  salesName: z.string().min(1).max(128),
  salesEmail: z.string().email(),
  salesPhone: z.string().max(32).optional(),
});
export type CreateCarrierInput = z.infer<typeof CreateCarrierInput>;

export const UpdateCarrierInput = CreateCarrierInput.partial();
export type UpdateCarrierInput = z.infer<typeof UpdateCarrierInput>;

export const CarrierListItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  businessName: z.string(),
  status: CarrierStatusEnum,
  trunkCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CarrierListItem = z.infer<typeof CarrierListItemSchema>;

export const CarrierListSortByEnum = z.enum([
  "name",
  "businessName",
  "status",
  "trunkCount",
  "createdAt",
]);
export type CarrierListSortBy = z.infer<typeof CarrierListSortByEnum>;

export const CarrierListSortDirEnum = z.enum(["asc", "desc"]);
export type CarrierListSortDir = z.infer<typeof CarrierListSortDirEnum>;

export const CarrierListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(200).optional(),
  sortBy: CarrierListSortByEnum.default("name"),
  sortDir: CarrierListSortDirEnum.default("asc"),
});
export type CarrierListQuery = z.infer<typeof CarrierListQuerySchema>;

export const CarrierListResponseSchema = z.object({
  carriers: z.array(CarrierListItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});
export type CarrierListResponse = z.infer<typeof CarrierListResponseSchema>;

export const VoiceNumberingPlanStatusEnum = z.enum(["active", "inactive"]);
export type VoiceNumberingPlanStatus = z.infer<typeof VoiceNumberingPlanStatusEnum>;

export const VoiceNumberingPlanListItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  status: VoiceNumberingPlanStatusEnum,
  destinationCount: z.number().int().nonnegative(),
  codeCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type VoiceNumberingPlanListItem = z.infer<
  typeof VoiceNumberingPlanListItemSchema
>;

export const VoiceNumberingPlanListResponseSchema = z.object({
  plans: z.array(VoiceNumberingPlanListItemSchema),
});
export type VoiceNumberingPlanListResponse = z.infer<
  typeof VoiceNumberingPlanListResponseSchema
>;

export const VoiceNumberingPlanDetailSchema = VoiceNumberingPlanListItemSchema;
export type VoiceNumberingPlanDetail = z.infer<
  typeof VoiceNumberingPlanDetailSchema
>;

export const VoiceNumberingPlanDestinationTypeEnum = z.enum([
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
]);
export type VoiceNumberingPlanDestinationType = z.infer<
  typeof VoiceNumberingPlanDestinationTypeEnum
>;

export const VoiceNumberingPlanDestinationListItemSchema = z.object({
  id: z.string().uuid(),
  countryIso2: z.string(),
  countryName: z.string(),
  name: z.string(),
  type: VoiceNumberingPlanDestinationTypeEnum.nullable(),
  countryCode: z.string().nullable(),
  destinationCodes: z.array(z.string()),
  codeCount: z.number().int().nonnegative(),
  website: z.string().url().nullable(),
});
export type VoiceNumberingPlanDestinationListItem = z.infer<
  typeof VoiceNumberingPlanDestinationListItemSchema
>;

export const VoiceNumberingPlanDestinationSortByEnum = z.enum([
  "countryName",
  "countryIso2",
  "name",
  "type",
  "codeCount",
]);
export type VoiceNumberingPlanDestinationSortBy = z.infer<
  typeof VoiceNumberingPlanDestinationSortByEnum
>;

export const VoiceNumberingPlanLocaleEnum = z.enum(["en", "it"]);
export type VoiceNumberingPlanLocale = z.infer<
  typeof VoiceNumberingPlanLocaleEnum
>;

export const VoiceNumberingPlanDestinationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(200).optional(),
  sortBy: VoiceNumberingPlanDestinationSortByEnum.default("countryName"),
  sortDir: CarrierListSortDirEnum.default("asc"),
  locale: VoiceNumberingPlanLocaleEnum.default("en"),
});
export type VoiceNumberingPlanDestinationListQuery = z.infer<
  typeof VoiceNumberingPlanDestinationListQuerySchema
>;

export const VoiceNumberingPlanDestinationListResponseSchema = z.object({
  destinations: z.array(VoiceNumberingPlanDestinationListItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});
export type VoiceNumberingPlanDestinationListResponse = z.infer<
  typeof VoiceNumberingPlanDestinationListResponseSchema
>;

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

export const AtVoiceTerminationStatusEnum = z.enum(["active", "inactive"]);
export type AtVoiceTerminationStatus = z.infer<typeof AtVoiceTerminationStatusEnum>;

export const CurrencyEnum = z.enum(["usd", "eur", "gbp"]);
export type Currency = z.infer<typeof CurrencyEnum>;

export const AtVoiceTerminationSchema = z.object({
  id: z.string().uuid(),
  status: AtVoiceTerminationStatusEnum,
  carrierId: z.string().uuid(),
  name: z.string().min(1).max(128),
  internalRouteName: z.string().min(1).max(128),
  currency: CurrencyEnum,
  countryCode: CountryCode,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});
export type AtVoiceTermination = z.infer<typeof AtVoiceTerminationSchema>;

export const CreateAtVoiceTerminationInput = z.object({
  status: AtVoiceTerminationStatusEnum.default("active"),
  carrierId: z.string().uuid(),
  name: z.string().min(1).max(128),
  internalRouteName: z.string().min(1).max(128),
  currency: CurrencyEnum,
  countryCode: CountryCode,
});
export type CreateAtVoiceTerminationInput = z.infer<typeof CreateAtVoiceTerminationInput>;

export const UpdateAtVoiceTerminationInput = CreateAtVoiceTerminationInput.partial();
export type UpdateAtVoiceTerminationInput = z.infer<typeof UpdateAtVoiceTerminationInput>;

export const VoiceTrunkStatusEnum = z.enum(["active", "inactive", "testing"]);
export type VoiceTrunkStatus = z.infer<typeof VoiceTrunkStatusEnum>;

export const VoiceTrunkDirectionEnum = z.enum(["inbound", "outbound", "both"]);
export type VoiceTrunkDirection = z.infer<typeof VoiceTrunkDirectionEnum>;

export const VoiceTrunkProtocolEnum = z.enum(["sip", "sips"]);
export type VoiceTrunkProtocol = z.infer<typeof VoiceTrunkProtocolEnum>;

export const VoiceTrunkTransportEnum = z.enum(["udp", "tcp", "tls"]);
export type VoiceTrunkTransport = z.infer<typeof VoiceTrunkTransportEnum>;

export const VoiceTrunkAuthTypeEnum = z.enum(["ip", "userpass", "both"]);
export type VoiceTrunkAuthType = z.infer<typeof VoiceTrunkAuthTypeEnum>;

export const VoiceTrunkDtmfModeEnum = z.enum(["rfc2833", "inband", "info"]);
export type VoiceTrunkDtmfMode = z.infer<typeof VoiceTrunkDtmfModeEnum>;

export const VoiceTrunkNatModeEnum = z.enum(["no", "yes", "force_rport", "comedia"]);
export type VoiceTrunkNatMode = z.infer<typeof VoiceTrunkNatModeEnum>;

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

const voiceTrunkBaseFields = {
  carrierId: z.string().uuid(),
  name: z.string().min(1).max(128),
  status: VoiceTrunkStatusEnum.default("active"),
  direction: VoiceTrunkDirectionEnum.default("both"),
  protocol: VoiceTrunkProtocolEnum.default("sip"),
  transport: VoiceTrunkTransportEnum.default("udp"),
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
  dtmfMode: VoiceTrunkDtmfModeEnum.default("rfc2833"),
  natMode: VoiceTrunkNatModeEnum.default("no"),
  metadata: z.record(z.string(), z.unknown()).optional(),
};

export const VoiceTrunkSchema = z.object({
  id: z.string().uuid(),
  carrierId: z.string().uuid(),
  name: z.string(),
  status: VoiceTrunkStatusEnum,
  direction: VoiceTrunkDirectionEnum,
  protocol: VoiceTrunkProtocolEnum,
  transport: VoiceTrunkTransportEnum,
  host: z.string(),
  port: Port,
  authType: VoiceTrunkAuthTypeEnum,
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
  dtmfMode: VoiceTrunkDtmfModeEnum,
  natMode: VoiceTrunkNatModeEnum,
  ipAcl: z.array(IpOrCidr).nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});
export type VoiceTrunk = z.infer<typeof VoiceTrunkSchema>;

export const CreateVoiceTrunkInput = z.discriminatedUnion("authType", [
  z.object({
    authType: z.literal("ip"),
    ipAcl: z.array(IpOrCidr).min(1),
    ...voiceTrunkBaseFields,
  }),
  z.object({
    authType: z.literal("userpass"),
    username: z.string().min(1).max(128),
    password: z.string().min(1).max(256),
    ...voiceTrunkBaseFields,
  }),
  z.object({
    authType: z.literal("both"),
    ipAcl: z.array(IpOrCidr).min(1),
    username: z.string().min(1).max(128),
    password: z.string().min(1).max(256),
    ...voiceTrunkBaseFields,
  }),
]);
export type CreateVoiceTrunkInput = z.infer<typeof CreateVoiceTrunkInput>;

export const UpdateVoiceTrunkInput = z.object({
  ...Object.fromEntries(
    Object.entries(voiceTrunkBaseFields).map(([k, v]) => [
      k,
      (v as z.ZodType).optional(),
    ]),
  ),
  authType: VoiceTrunkAuthTypeEnum.optional(),
  username: z.string().min(1).max(128).nullable().optional(),
  password: z.string().min(1).max(256).optional(),
  ipAcl: z.array(IpOrCidr).min(1).nullable().optional(),
});
export type UpdateVoiceTrunkInput = z.infer<typeof UpdateVoiceTrunkInput>;

export const AtVoiceNumberDigits = z
  .string()
  .min(3)
  .max(32)
  .regex(/^\+?[0-9]+$/, "digits only, optional leading +");

export const AtVoiceNumberSchema = z.object({
  id: z.string().uuid(),
  atVoiceTerminationId: z.string().uuid(),
  number: AtVoiceNumberDigits,
  lastSuccessfulAttemptAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});
export type AtVoiceNumber = z.infer<typeof AtVoiceNumberSchema>;

export const CreateAtVoiceNumberInput = z.object({
  atVoiceTerminationId: z.string().uuid(),
  number: AtVoiceNumberDigits,
});
export type CreateAtVoiceNumberInput = z.infer<typeof CreateAtVoiceNumberInput>;

export const UpdateAtVoiceNumberInput = z.object({
  atVoiceTerminationId: z.string().uuid().optional(),
  number: AtVoiceNumberDigits.optional(),
  lastSuccessfulAttemptAt: z.string().datetime().nullable().optional(),
});
export type UpdateAtVoiceNumberInput = z.infer<typeof UpdateAtVoiceNumberInput>;

export const MoneyRate = z
  .string()
  .regex(/^-?\d+(\.\d+)?$/, "decimal string");
export type MoneyRate = z.infer<typeof MoneyRate>;

export const VoiceCdrSchema = z.object({
  id: z.string().uuid(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable(),
  durationSecs: z.number().int().nonnegative(),
  buyCurrency: CurrencyEnum,
  buyRate: MoneyRate,
  sellCurrency: CurrencyEnum,
  sellRate: MoneyRate,
  internalRouteName: z.string().min(1).max(128),
  inboundRouteName: z.string().min(1).max(128).nullable(),
  outboundRouteName: z.string().min(1).max(128).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});
export type VoiceCdr = z.infer<typeof VoiceCdrSchema>;

export const CreateVoiceCdrInput = z.object({
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().optional(),
  durationSecs: z.number().int().nonnegative(),
  buyCurrency: CurrencyEnum,
  buyRate: MoneyRate,
  sellCurrency: CurrencyEnum,
  sellRate: MoneyRate,
  internalRouteName: z.string().min(1).max(128),
  inboundRouteName: z.string().min(1).max(128).optional(),
  outboundRouteName: z.string().min(1).max(128).optional(),
});
export type CreateVoiceCdrInput = z.infer<typeof CreateVoiceCdrInput>;

export const UpdateVoiceCdrInput = CreateVoiceCdrInput.partial();
export type UpdateVoiceCdrInput = z.infer<typeof UpdateVoiceCdrInput>;

export const UserWithRolesSchema = UserSchema.extend({
  roles: z.array(
    RoleSchema.extend({
      permissions: z.array(PermissionSchema),
    }),
  ),
});
export type UserWithRoles = z.infer<typeof UserWithRolesSchema>;
