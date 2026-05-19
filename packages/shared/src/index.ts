import { z } from "zod";

declare const process: { env: Record<string, string | undefined> } | undefined;

function resolveAppTimezone(): string {
  const tz =
    (typeof process !== "undefined" ? process.env.APP_TIMEZONE : undefined) ??
    "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
  } catch {
    throw new Error(`Invalid APP_TIMEZONE: ${tz}`);
  }
  return tz;
}

export const APP_TIMEZONE = resolveAppTimezone();

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
  .regex(
    /^[a-z0-9_]+(\.[a-z0-9_]+)+$/,
    "use dot.notation, e.g. transcript.create",
  );

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

export const BillingTermsSchema = z.object({
  cycleDays: z.number().int().min(1).max(365),
  dueDays: z.number().int().min(0).max(365),
});
export type BillingTerms = z.infer<typeof BillingTermsSchema>;

export const CarrierBillingDetailsSchema = z.object({
  address: CarrierAddressSchema,
  taxId: z.string().max(64).optional(),
  billingTerms: BillingTermsSchema.optional(),
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
  status: z
    .string()
    .trim()
    .optional()
    .transform((v) =>
      v ? v.split(",").map((s) => s.trim()).filter(Boolean) : [],
    )
    .pipe(z.array(CarrierStatusEnum)),
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
export type VoiceNumberingPlanStatus = z.infer<
  typeof VoiceNumberingPlanStatusEnum
>;

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

export const VoiceNumberingPlanListSortByEnum = z.enum([
  "name",
  "status",
  "destinationCount",
  "codeCount",
  "createdAt",
]);
export type VoiceNumberingPlanListSortBy = z.infer<
  typeof VoiceNumberingPlanListSortByEnum
>;

export const VoiceNumberingPlanListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(200).optional(),
  sortBy: VoiceNumberingPlanListSortByEnum.default("name"),
  sortDir: CarrierListSortDirEnum.default("asc"),
});
export type VoiceNumberingPlanListQuery = z.infer<
  typeof VoiceNumberingPlanListQuerySchema
>;

export const VoiceNumberingPlanListResponseSchema = z.object({
  plans: z.array(VoiceNumberingPlanListItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
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
  prefix: z
    .string()
    .trim()
    .transform((v) => v.replace(/[^0-9]/g, ""))
    .pipe(z.string().max(32))
    .optional(),
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

export const VoiceRateSheetStatusEnum = z.enum(["active", "inactive"]);
export type VoiceRateSheetStatus = z.infer<typeof VoiceRateSheetStatusEnum>;

export const VoiceRateSheetListItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  status: VoiceRateSheetStatusEnum,
  voiceNumberingPlanId: z.string().uuid(),
  voiceNumberingPlanName: z.string(),
  currency: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type VoiceRateSheetListItem = z.infer<
  typeof VoiceRateSheetListItemSchema
>;

export const VoiceRateSheetListSortByEnum = z.enum([
  "name",
  "voiceNumberingPlanName",
  "currency",
  "createdAt",
]);
export type VoiceRateSheetListSortBy = z.infer<
  typeof VoiceRateSheetListSortByEnum
>;

export const VoiceRateSheetListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(200).optional(),
  status: z
    .string()
    .trim()
    .optional()
    .transform((v) =>
      v ? v.split(",").map((s) => s.trim()).filter(Boolean) : [],
    )
    .pipe(z.array(VoiceRateSheetStatusEnum)),
  sortBy: VoiceRateSheetListSortByEnum.default("name"),
  sortDir: CarrierListSortDirEnum.default("asc"),
});
export type VoiceRateSheetListQuery = z.infer<
  typeof VoiceRateSheetListQuerySchema
>;

export const VoiceRateSheetListResponseSchema = z.object({
  rateSheets: z.array(VoiceRateSheetListItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});
export type VoiceRateSheetListResponse = z.infer<
  typeof VoiceRateSheetListResponseSchema
>;

export const VoiceRateSheetDetailSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  status: VoiceRateSheetStatusEnum,
  voiceNumberingPlanId: z.string().uuid(),
  voiceNumberingPlanName: z.string(),
  currency: z.string(),
  lineCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type VoiceRateSheetDetail = z.infer<typeof VoiceRateSheetDetailSchema>;

export const VoiceRateSheetLineListItemSchema = z.object({
  id: z.string().uuid(),
  destinationId: z.string().uuid(),
  countryIso2: z.string(),
  countryName: z.string(),
  destinationName: z.string(),
  minDurationSeconds: z.number().int().nonnegative(),
  incrementSeconds: z.number().int().positive(),
  setupFee: z.string().nullable(),
  ratePerMinute: z.string(),
  validFrom: z.string().datetime(),
  validTo: z.string().datetime().nullable(),
  countryCode: z.string().nullable(),
  destinationCodes: z.array(z.string()),
  codeCount: z.number().int().nonnegative(),
});
export type VoiceRateSheetLineListItem = z.infer<
  typeof VoiceRateSheetLineListItemSchema
>;

export const VoiceRateSheetLineSortByEnum = z.enum([
  "countryName",
  "destinationName",
  "ratePerMinute",
  "setupFee",
  "validFrom",
  "validTo",
  "codeCount",
]);
export type VoiceRateSheetLineSortBy = z.infer<
  typeof VoiceRateSheetLineSortByEnum
>;

export const VoiceRateSheetLineListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(200).optional(),
  prefix: z
    .string()
    .trim()
    .transform((v) => v.replace(/[^0-9]/g, ""))
    .pipe(z.string().max(32))
    .optional(),
  sortBy: VoiceRateSheetLineSortByEnum.default("countryName"),
  sortDir: CarrierListSortDirEnum.default("asc"),
  locale: VoiceNumberingPlanLocaleEnum.default("en"),
});
export type VoiceRateSheetLineListQuery = z.infer<
  typeof VoiceRateSheetLineListQuerySchema
>;

export const VoiceRateSheetLineListResponseSchema = z.object({
  lines: z.array(VoiceRateSheetLineListItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});
export type VoiceRateSheetLineListResponse = z.infer<
  typeof VoiceRateSheetLineListResponseSchema
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
  .refine((v) => (v.userId === null) !== (v.carrierId === null), {
    message: "exactly one of userId/carrierId must be set",
  });
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

export const AtVoiceRangeStatusEnum = z.enum(["active", "inactive"]);
export type AtVoiceRangeStatus = z.infer<
  typeof AtVoiceRangeStatusEnum
>;

export const CurrencyEnum = z.enum(["usd", "eur", "gbp"]);
export type Currency = z.infer<typeof CurrencyEnum>;

export const AtVoiceRangeSchema = z.object({
  id: z.string().uuid(),
  status: AtVoiceRangeStatusEnum,
  carrierId: z.string().uuid(),
  voiceNumberingPlanId: z.string().uuid(),
  name: z.string().min(1).max(128),
  currency: CurrencyEnum,
  countryIso2: CountryCode,
  maxDailyTotalMinutes: z.number().int().positive().nullable(),
  maxDailyMinutesANumber: z.number().int().positive().nullable(),
  maxDailyMinutesBNumber: z.number().int().positive().nullable(),
  maxDailyMinutesAToBNumber: z.number().int().positive().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});
export type AtVoiceRange = z.infer<typeof AtVoiceRangeSchema>;

export const CreateAtVoiceRangeInput = z.object({
  status: AtVoiceRangeStatusEnum.default("active"),
  carrierId: z.string().uuid(),
  voiceNumberingPlanId: z.string().uuid(),
  name: z.string().min(1).max(128),
  currency: CurrencyEnum,
  countryIso2: CountryCode,
  maxDailyTotalMinutes: z.number().int().positive().optional(),
  maxDailyMinutesANumber: z.number().int().positive().optional(),
  maxDailyMinutesBNumber: z.number().int().positive().optional(),
  maxDailyMinutesAToBNumber: z.number().int().positive().optional(),
});
export type CreateAtVoiceRangeInput = z.infer<
  typeof CreateAtVoiceRangeInput
>;

export const UpdateAtVoiceRangeInput =
  CreateAtVoiceRangeInput.partial();
export type UpdateAtVoiceRangeInput = z.infer<
  typeof UpdateAtVoiceRangeInput
>;

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

export const VoiceTrunkNatModeEnum = z.enum([
  "no",
  "yes",
  "force_rport",
  "comedia",
]);
export type VoiceTrunkNatMode = z.infer<typeof VoiceTrunkNatModeEnum>;

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
  registerEnabled: z.boolean().default(false),
  proxy: z.string().max(255).optional(),
  expiresSeconds: PositiveInt.optional(),
  qualifySeconds: PositiveInt.optional(),
  maxChannels: PositiveInt.optional(),
  cpsLimit: PositiveInt.optional(),
  maxCallDurationSeconds: PositiveInt.optional(),
  capacityLines: PositiveInt.optional(),
  rtpTimeoutSeconds: PositiveInt.optional(),
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
  registerEnabled: z.boolean(),
  proxy: z.string().nullable(),
  expiresSeconds: z.number().int().nullable(),
  qualifySeconds: z.number().int().nullable(),
  maxChannels: z.number().int().nullable(),
  cpsLimit: z.number().int().nullable(),
  maxCallDurationSeconds: z.number().int().nullable(),
  capacityLines: z.number().int().nullable(),
  rtpTimeoutSeconds: z.number().int().nullable(),
  codecs: z.array(CodecCode),
  dtmfMode: VoiceTrunkDtmfModeEnum,
  natMode: VoiceTrunkNatModeEnum,
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});
export type VoiceTrunk = z.infer<typeof VoiceTrunkSchema>;

export const CreateVoiceTrunkInput = z.discriminatedUnion("authType", [
  z.object({
    authType: z.literal("ip"),
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
});
export type UpdateVoiceTrunkInput = z.infer<typeof UpdateVoiceTrunkInput>;

export const VoiceTrunkListItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  status: VoiceTrunkStatusEnum,
  carrierId: z.string().uuid(),
  carrierName: z.string(),
  voiceRateSheetId: z.string().uuid().nullable(),
  voiceRateSheetName: z.string().nullable(),
  ipCount: z.number().int().nonnegative(),
  ips: z.array(z.string()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type VoiceTrunkListItem = z.infer<typeof VoiceTrunkListItemSchema>;

export const VoiceTrunkListSortByEnum = z.enum([
  "name",
  "carrierName",
  "voiceRateSheetName",
  "createdAt",
]);
export type VoiceTrunkListSortBy = z.infer<typeof VoiceTrunkListSortByEnum>;

export const VoiceTrunkListSortDirEnum = z.enum(["asc", "desc"]);
export type VoiceTrunkListSortDir = z.infer<typeof VoiceTrunkListSortDirEnum>;

export const VoiceTrunkListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(200).optional(),
  carrier: z.string().trim().max(200).optional(),
  ip: z.string().trim().max(200).optional(),
  status: z
    .string()
    .trim()
    .optional()
    .transform((v) =>
      v ? v.split(",").map((s) => s.trim()).filter(Boolean) : [],
    )
    .pipe(z.array(VoiceTrunkStatusEnum)),
  sortBy: VoiceTrunkListSortByEnum.default("name"),
  sortDir: VoiceTrunkListSortDirEnum.default("asc"),
});
export type VoiceTrunkListQuery = z.infer<typeof VoiceTrunkListQuerySchema>;

export const VoiceTrunkListResponseSchema = z.object({
  trunks: z.array(VoiceTrunkListItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});
export type VoiceTrunkListResponse = z.infer<typeof VoiceTrunkListResponseSchema>;

export const VoiceTrunkIpStatusEnum = z.enum(["active", "inactive"]);
export type VoiceTrunkIpStatus = z.infer<typeof VoiceTrunkIpStatusEnum>;

export const IpAddress = z.union([z.ipv4(), z.ipv6()]);

export const VoiceTrunkIpSchema = z.object({
  id: z.string().uuid(),
  voiceTrunkId: z.string().uuid(),
  ip: z.string(),
  prefix: z.string().nullable(),
  sourceCidr: z.string().nullable(),
  status: VoiceTrunkIpStatusEnum,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type VoiceTrunkIp = z.infer<typeof VoiceTrunkIpSchema>;

const CidrString = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F.:]+\/\d{1,3}$/, "must look like 1.2.3.0/24 or 2001:db8::/120");

export const CreateVoiceTrunkIpInput = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("single"),
    ip: IpAddress,
    prefix: z.string().trim().min(1).max(64).optional(),
    status: VoiceTrunkIpStatusEnum.default("active"),
  }),
  z.object({
    kind: z.literal("cidr"),
    cidr: CidrString,
    prefix: z.string().trim().min(1).max(64).optional(),
    status: VoiceTrunkIpStatusEnum.default("active"),
  }),
]);
export type CreateVoiceTrunkIpInput = z.infer<typeof CreateVoiceTrunkIpInput>;

export const CreateVoiceTrunkIpCidrResultSchema = z.object({
  kind: z.literal("cidr"),
  canonicalCidr: z.string(),
  inserted: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
});
export type CreateVoiceTrunkIpCidrResult = z.infer<
  typeof CreateVoiceTrunkIpCidrResultSchema
>;

export const CreateVoiceTrunkIpResponseSchema = z.union([
  VoiceTrunkIpSchema,
  CreateVoiceTrunkIpCidrResultSchema,
]);

export const UpdateVoiceTrunkIpInput = z.object({
  prefix: z.string().trim().min(1).max(64).nullable().optional(),
  status: VoiceTrunkIpStatusEnum.optional(),
});
export type UpdateVoiceTrunkIpInput = z.infer<typeof UpdateVoiceTrunkIpInput>;

export const UpdateVoiceTrunkIpRangeInput = z.object({
  sourceCidr: CidrString,
  prefix: z.string().trim().min(1).max(64).nullable().optional(),
  status: VoiceTrunkIpStatusEnum.optional(),
});
export type UpdateVoiceTrunkIpRangeInput = z.infer<
  typeof UpdateVoiceTrunkIpRangeInput
>;

export const DeleteVoiceTrunkIpRangeInput = z.object({
  sourceCidr: CidrString,
});
export type DeleteVoiceTrunkIpRangeInput = z.infer<
  typeof DeleteVoiceTrunkIpRangeInput
>;

export const VoiceTrunkIpRangeMutationResultSchema = z.object({
  affected: z.number().int().nonnegative(),
});
export type VoiceTrunkIpRangeMutationResult = z.infer<
  typeof VoiceTrunkIpRangeMutationResultSchema
>;

export const VoiceTrunkIpListResponseSchema = z.object({
  ips: z.array(VoiceTrunkIpSchema),
});
export type VoiceTrunkIpListResponse = z.infer<typeof VoiceTrunkIpListResponseSchema>;

export const VoiceTrunkIpConflictResponseSchema = z.object({
  error: z.enum([
    "duplicate_ip",
    "ip_owned_by_other_carrier",
    "cidr_too_large",
    "cidr_invalid",
  ]),
  existingCarrierName: z.string().optional(),
  conflictingIp: z.string().optional(),
  detail: z.string().optional(),
});
export type VoiceTrunkIpConflictResponse = z.infer<
  typeof VoiceTrunkIpConflictResponseSchema
>;

export const AtVoiceNumberDigits = z
  .string()
  .min(3)
  .max(32)
  .regex(/^\+?[0-9]+$/, "digits only, optional leading +");

export const AtVoiceNumberSchema = z.object({
  id: z.string().uuid(),
  atVoiceRangeId: z.string().uuid(),
  number: AtVoiceNumberDigits,
  lastSuccessfulAttemptAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});
export type AtVoiceNumber = z.infer<typeof AtVoiceNumberSchema>;

export const CreateAtVoiceNumberInput = z.object({
  atVoiceRangeId: z.string().uuid(),
  number: AtVoiceNumberDigits,
});
export type CreateAtVoiceNumberInput = z.infer<typeof CreateAtVoiceNumberInput>;

export const UpdateAtVoiceNumberInput = z.object({
  atVoiceRangeId: z.string().uuid().optional(),
  number: AtVoiceNumberDigits.optional(),
  lastSuccessfulAttemptAt: z.string().datetime().nullable().optional(),
});
export type UpdateAtVoiceNumberInput = z.infer<typeof UpdateAtVoiceNumberInput>;

export const MoneyRate = z.string().regex(/^-?\d+(\.\d+)?$/, "decimal string");
export type MoneyRate = z.infer<typeof MoneyRate>;

export const VoiceCdrSchema = z.object({
  id: z.string().uuid(),
  atVoiceRangeId: z.string().uuid(),
  voiceTrunkId: z.string().uuid(),
  aNumber: z.string().min(1).max(64),
  bNumber: z.string().min(1).max(64),
  bNumberDialed: z.string().min(1).max(64),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable(),
  durationSeconds: z.number().int().nonnegative(),
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
  atVoiceRangeId: z.string().uuid(),
  voiceTrunkId: z.string().uuid(),
  aNumber: z.string().min(1).max(64),
  bNumber: z.string().min(1).max(64),
  bNumberDialed: z.string().min(1).max(64),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().optional(),
  durationSeconds: z.number().int().nonnegative(),
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
