import { and, eq, isNull } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";
import type {
  CarrierBillingDetails,
  ChatApp,
  NewCarrierRow,
  NewVoiceTrunkRow,
} from "./schema.js";
import { seedAtVoiceNumbers } from "./seed-at-voice-numbers.js";
import { seedAtVoiceRanges } from "./seed-at-voice-ranges.js";
import { seedCountries } from "./seed-countries.js";
import { seedVoiceNumberingPlan } from "./seed-voice-numbering-plan.js";
import { seedVoiceRateSheets } from "./seed-voice-rate-sheets.js";

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
      and(
        eq(schema.roles.scope, "admin"),
        eq(schema.roles.name, ADMIN_ROLE_NAME),
        isNull(schema.roles.deletedAt),
      ),
    )
    .limit(1);
  if (existing[0]) return existing[0].id;

  const [created] = await db
    .insert(schema.roles)
    .values({
      scope: "admin",
      name: ADMIN_ROLE_NAME,
      description: "Administrator",
    })
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

type CarrierSeed = Omit<
  NewCarrierRow,
  "id" | "createdAt" | "updatedAt" | "deletedAt"
>;

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
      name: "tim",
      businessName: "Telecom Italia S.p.A.",
      ratesName: "Marco Rossi",
      ratesEmail: "rates@tim.example.com",
      billingName: "Giulia Bianchi",
      billingEmail: "billing@tim.example.com",
      nocName: "TIM NOC",
      nocEmail: "noc@tim.example.com",
      salesName: "Luca Verdi",
      salesEmail: "sales@tim.example.com",
      billingDetails: {
        address: {
          line1: "Via Gaetano Negri 1",
          city: "Milano",
          postalCode: "20123",
          countryCode: "IT",
        },
        taxId: "IT00488410010",
        billingTerms: { cycleDays: 30, dueDays: 30 },
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
      { chatApp: "telegram", chatId: "@tim_noc" },
    ],
  },
  {
    carrier: {
      name: "vodafone-uk",
      businessName: "Vodafone Limited",
      ratesName: "Sarah Connor",
      ratesEmail: "rates@vodafone-uk.example.com",
      billingName: "John Doe",
      billingEmail: "ar@vodafone-uk.example.com",
      nocName: "Vodafone UK NOC",
      nocEmail: "noc@vodafone-uk.example.com",
      salesName: "Kyle Reese",
      salesEmail: "sales@vodafone-uk.example.com",
      billingDetails: {
        address: {
          line1: "Vodafone House, The Connection",
          city: "Newbury",
          postalCode: "RG14 2FN",
          countryCode: "GB",
        },
        taxId: "GB569953277",
        billingTerms: { cycleDays: 15, dueDays: 15 },
      } satisfies CarrierBillingDetails,
    },
    contacts: [
      { chatApp: "whatsapp", chatId: "+447700900123" },
      { chatApp: "signal", chatId: "+447700900124" },
    ],
  },
  {
    carrier: {
      name: "att",
      businessName: "AT&T Communications LLC",
      ratesName: "Peter Gibbons",
      ratesEmail: "rates@att.example.com",
      billingName: "Bill Lumbergh",
      billingEmail: "billing@att.example.com",
      nocName: "AT&T NOC",
      nocEmail: "noc@att.example.com",
      salesName: "Michael Bolton",
      salesEmail: "sales@att.example.com",
      billingDetails: {
        address: {
          line1: "208 S Akard St",
          city: "Dallas",
          state: "TX",
          postalCode: "75202",
          countryCode: "US",
        },
        taxId: "US-EIN-43-1301883",
        billingTerms: { cycleDays: 30, dueDays: 45 },
        notes: "Send invoices PDF only",
      } satisfies CarrierBillingDetails,
    },
    contacts: [{ chatApp: "telegram", chatId: "@att_ops" }],
  },
];

type CountryProfile = {
  city: string;
  postalCode: string;
  street: string;
  state?: string;
  phonePrefix: string;
  taxPrefix: string;
};

const COUNTRIES: Record<string, CountryProfile> = {
  IT: { city: "Milano", postalCode: "20121", street: "Via Roma", phonePrefix: "+3902", taxPrefix: "IT" },
  GB: { city: "London", postalCode: "EC1A 1BB", street: "High Street", phonePrefix: "+4420", taxPrefix: "GB" },
  DE: { city: "Berlin", postalCode: "10115", street: "Hauptstrasse", phonePrefix: "+4930", taxPrefix: "DE" },
  FR: { city: "Paris", postalCode: "75001", street: "Rue de Rivoli", phonePrefix: "+3314", taxPrefix: "FR" },
  ES: { city: "Madrid", postalCode: "28001", street: "Calle Mayor", phonePrefix: "+3491", taxPrefix: "ES" },
  NL: { city: "Amsterdam", postalCode: "1011", street: "Damrak", phonePrefix: "+3120", taxPrefix: "NL" },
  BE: { city: "Brussels", postalCode: "1000", street: "Rue de la Loi", phonePrefix: "+322", taxPrefix: "BE" },
  CH: { city: "Zurich", postalCode: "8001", street: "Bahnhofstrasse", phonePrefix: "+4144", taxPrefix: "CH" },
  AT: { city: "Vienna", postalCode: "1010", street: "Stephansplatz", phonePrefix: "+431", taxPrefix: "AT" },
  SE: { city: "Stockholm", postalCode: "11122", street: "Drottninggatan", phonePrefix: "+468", taxPrefix: "SE" },
  NO: { city: "Oslo", postalCode: "0150", street: "Karl Johans Gate", phonePrefix: "+4722", taxPrefix: "NO" },
  FI: { city: "Helsinki", postalCode: "00100", street: "Mannerheimintie", phonePrefix: "+3589", taxPrefix: "FI" },
  DK: { city: "Copenhagen", postalCode: "1050", street: "Stroget", phonePrefix: "+4533", taxPrefix: "DK" },
  IE: { city: "Dublin", postalCode: "D02 X285", street: "O'Connell Street", phonePrefix: "+3531", taxPrefix: "IE" },
  HU: { city: "Budapest", postalCode: "1051", street: "Andrassy ut", phonePrefix: "+361", taxPrefix: "HU" },
  PL: { city: "Warsaw", postalCode: "00-001", street: "Marszalkowska", phonePrefix: "+4822", taxPrefix: "PL" },
  CZ: { city: "Prague", postalCode: "11000", street: "Vaclavske namesti", phonePrefix: "+4202", taxPrefix: "CZ" },
  TR: { city: "Istanbul", postalCode: "34000", street: "Istiklal Caddesi", phonePrefix: "+90212", taxPrefix: "TR" },
  US: { city: "Austin", state: "TX", postalCode: "78701", street: "Congress Ave", phonePrefix: "+1512", taxPrefix: "US-EIN-" },
  CA: { city: "Toronto", state: "ON", postalCode: "M5H 2N2", street: "Bay Street", phonePrefix: "+1416", taxPrefix: "CA" },
  MX: { city: "Mexico City", postalCode: "06000", street: "Paseo de la Reforma", phonePrefix: "+5255", taxPrefix: "MX" },
  AR: { city: "Buenos Aires", postalCode: "C1001", street: "Avenida 9 de Julio", phonePrefix: "+5411", taxPrefix: "AR" },
  BR: { city: "Sao Paulo", postalCode: "01000-000", street: "Avenida Paulista", phonePrefix: "+5511", taxPrefix: "BR" },
  CL: { city: "Santiago", postalCode: "8320000", street: "Avenida Providencia", phonePrefix: "+562", taxPrefix: "CL" },
  IN: { city: "Mumbai", postalCode: "400001", street: "Marine Drive", phonePrefix: "+9122", taxPrefix: "IN" },
  JP: { city: "Tokyo", postalCode: "100-0001", street: "Chiyoda", phonePrefix: "+8133", taxPrefix: "JP" },
  CN: { city: "Beijing", postalCode: "100000", street: "Chang'an Avenue", phonePrefix: "+8610", taxPrefix: "CN" },
  KR: { city: "Seoul", postalCode: "04524", street: "Sejong-daero", phonePrefix: "+822", taxPrefix: "KR" },
  SG: { city: "Singapore", postalCode: "049315", street: "Marina Bay", phonePrefix: "+65", taxPrefix: "SG" },
  ID: { city: "Jakarta", postalCode: "10110", street: "Jalan Sudirman", phonePrefix: "+6221", taxPrefix: "ID" },
  TH: { city: "Bangkok", postalCode: "10110", street: "Sukhumvit Road", phonePrefix: "+662", taxPrefix: "TH" },
  ZA: { city: "Johannesburg", postalCode: "2000", street: "Commissioner Street", phonePrefix: "+2711", taxPrefix: "ZA" },
};

type OperatorProfile = {
  slug: string;
  businessName: string;
  countryCode: string;
};

const OPERATOR_POOL: OperatorProfile[] = [
  { slug: "iliad-italia", businessName: "Iliad Italia S.p.A.", countryCode: "IT" },
  { slug: "fastweb", businessName: "Fastweb S.p.A.", countryCode: "IT" },
  { slug: "postemobile", businessName: "PosteMobile S.p.A.", countryCode: "IT" },
  { slug: "bt-group", businessName: "BT Group plc", countryCode: "GB" },
  { slug: "ee-limited", businessName: "EE Limited", countryCode: "GB" },
  { slug: "o2-uk", businessName: "Telefonica UK Limited", countryCode: "GB" },
  { slug: "three-uk", businessName: "Hutchison 3G UK Limited", countryCode: "GB" },
  { slug: "virgin-media-o2", businessName: "Virgin Media O2", countryCode: "GB" },
  { slug: "deutsche-telekom", businessName: "Deutsche Telekom AG", countryCode: "DE" },
  { slug: "vodafone-de", businessName: "Vodafone GmbH", countryCode: "DE" },
  { slug: "telefonica-de", businessName: "Telefonica Germany GmbH", countryCode: "DE" },
  { slug: "oneandone", businessName: "1&1 Telecommunication SE", countryCode: "DE" },
  { slug: "orange-fr", businessName: "Orange S.A.", countryCode: "FR" },
  { slug: "sfr", businessName: "Societe Francaise du Radiotelephone", countryCode: "FR" },
  { slug: "bouygues-telecom", businessName: "Bouygues Telecom S.A.", countryCode: "FR" },
  { slug: "free-mobile", businessName: "Free Mobile S.A.S.", countryCode: "FR" },
  { slug: "telefonica-es", businessName: "Telefonica de Espana", countryCode: "ES" },
  { slug: "orange-es", businessName: "Orange Espana S.A.", countryCode: "ES" },
  { slug: "vodafone-es", businessName: "Vodafone Espana S.A.", countryCode: "ES" },
  { slug: "masmovil", businessName: "MasMovil Ibercom S.A.", countryCode: "ES" },
  { slug: "kpn", businessName: "Koninklijke KPN N.V.", countryCode: "NL" },
  { slug: "vodafoneziggo", businessName: "VodafoneZiggo Group B.V.", countryCode: "NL" },
  { slug: "t-mobile-nl", businessName: "T-Mobile Netherlands B.V.", countryCode: "NL" },
  { slug: "tele2-nl", businessName: "Tele2 Nederland B.V.", countryCode: "NL" },
  { slug: "proximus", businessName: "Proximus S.A.", countryCode: "BE" },
  { slug: "orange-be", businessName: "Orange Belgium S.A.", countryCode: "BE" },
  { slug: "telenet", businessName: "Telenet Group Holding", countryCode: "BE" },
  { slug: "swisscom", businessName: "Swisscom AG", countryCode: "CH" },
  { slug: "sunrise-ch", businessName: "Sunrise GmbH", countryCode: "CH" },
  { slug: "salt-ch", businessName: "Salt Mobile S.A.", countryCode: "CH" },
  { slug: "a1-austria", businessName: "A1 Telekom Austria AG", countryCode: "AT" },
  { slug: "magenta-telekom", businessName: "Magenta Telekom", countryCode: "AT" },
  { slug: "telia-se", businessName: "Telia Sverige AB", countryCode: "SE" },
  { slug: "tele2-se", businessName: "Tele2 Sverige AB", countryCode: "SE" },
  { slug: "telenor-no", businessName: "Telenor Norge AS", countryCode: "NO" },
  { slug: "telia-no", businessName: "Telia Norge AS", countryCode: "NO" },
  { slug: "elisa-fi", businessName: "Elisa Oyj", countryCode: "FI" },
  { slug: "dna-fi", businessName: "DNA Oyj", countryCode: "FI" },
  { slug: "tdc-dk", businessName: "TDC NET A/S", countryCode: "DK" },
  { slug: "three-dk", businessName: "Hi3G Denmark ApS", countryCode: "DK" },
  { slug: "eircom", businessName: "Eircom Limited", countryCode: "IE" },
  { slug: "vodafone-ie", businessName: "Vodafone Ireland Limited", countryCode: "IE" },
  { slug: "magyar-telekom", businessName: "Magyar Telekom Nyrt.", countryCode: "HU" },
  { slug: "vodafone-hu", businessName: "Vodafone Magyarorszag Zrt.", countryCode: "HU" },
  { slug: "orange-pl", businessName: "Orange Polska S.A.", countryCode: "PL" },
  { slug: "t-mobile-pl", businessName: "T-Mobile Polska S.A.", countryCode: "PL" },
  { slug: "plus-pl", businessName: "Polkomtel Sp. z o.o.", countryCode: "PL" },
  { slug: "play-pl", businessName: "P4 Sp. z o.o.", countryCode: "PL" },
  { slug: "cetin-cz", businessName: "CETIN a.s.", countryCode: "CZ" },
  { slug: "o2-cz", businessName: "O2 Czech Republic a.s.", countryCode: "CZ" },
  { slug: "turkcell", businessName: "Turkcell Iletisim Hizmetleri A.S.", countryCode: "TR" },
  { slug: "turk-telekom", businessName: "Turk Telekom", countryCode: "TR" },
  { slug: "vodafone-tr", businessName: "Vodafone Telekomunikasyon A.S.", countryCode: "TR" },
  { slug: "verizon", businessName: "Verizon Communications Inc.", countryCode: "US" },
  { slug: "t-mobile-us", businessName: "T-Mobile US Inc.", countryCode: "US" },
  { slug: "lumen", businessName: "Lumen Technologies Inc.", countryCode: "US" },
  { slug: "comcast-business", businessName: "Comcast Business Communications", countryCode: "US" },
  { slug: "charter", businessName: "Charter Communications Inc.", countryCode: "US" },
  { slug: "cox", businessName: "Cox Communications Inc.", countryCode: "US" },
  { slug: "us-cellular", businessName: "United States Cellular Corp.", countryCode: "US" },
  { slug: "bell-canada", businessName: "Bell Canada", countryCode: "CA" },
  { slug: "rogers", businessName: "Rogers Communications Inc.", countryCode: "CA" },
  { slug: "telus", businessName: "Telus Communications Inc.", countryCode: "CA" },
  { slug: "freedom-mobile", businessName: "Freedom Mobile Inc.", countryCode: "CA" },
  { slug: "telmex", businessName: "Telefonos de Mexico S.A.B.", countryCode: "MX" },
  { slug: "telcel", businessName: "Radiomovil Dipsa S.A. (Telcel)", countryCode: "MX" },
  { slug: "att-mexico", businessName: "AT&T Comunicaciones Digitales", countryCode: "MX" },
  { slug: "movistar-ar", businessName: "Telefonica Moviles Argentina", countryCode: "AR" },
  { slug: "claro-ar", businessName: "AMX Argentina S.A. (Claro)", countryCode: "AR" },
  { slug: "vivo-br", businessName: "Telefonica Brasil S.A. (Vivo)", countryCode: "BR" },
  { slug: "claro-br", businessName: "Claro S.A.", countryCode: "BR" },
  { slug: "tim-br", businessName: "TIM S.A.", countryCode: "BR" },
  { slug: "oi", businessName: "Oi S.A.", countryCode: "BR" },
  { slug: "entel-cl", businessName: "Entel PCS Telecomunicaciones", countryCode: "CL" },
  { slug: "movistar-cl", businessName: "Telefonica Moviles Chile", countryCode: "CL" },
  { slug: "reliance-jio", businessName: "Reliance Jio Infocomm Limited", countryCode: "IN" },
  { slug: "bharti-airtel", businessName: "Bharti Airtel Limited", countryCode: "IN" },
  { slug: "vodafone-idea", businessName: "Vodafone Idea Limited", countryCode: "IN" },
  { slug: "bsnl", businessName: "Bharat Sanchar Nigam Limited", countryCode: "IN" },
  { slug: "ntt-docomo", businessName: "NTT Docomo Inc.", countryCode: "JP" },
  { slug: "softbank", businessName: "SoftBank Corp.", countryCode: "JP" },
  { slug: "kddi-au", businessName: "KDDI Corporation", countryCode: "JP" },
  { slug: "rakuten-mobile", businessName: "Rakuten Mobile Inc.", countryCode: "JP" },
  { slug: "china-mobile", businessName: "China Mobile Communications Corp.", countryCode: "CN" },
  { slug: "china-unicom", businessName: "China United Network Communications", countryCode: "CN" },
  { slug: "china-telecom", businessName: "China Telecom Corp.", countryCode: "CN" },
  { slug: "sk-telecom", businessName: "SK Telecom Co. Ltd", countryCode: "KR" },
  { slug: "kt-corp", businessName: "KT Corporation", countryCode: "KR" },
  { slug: "lg-uplus", businessName: "LG Uplus Corp.", countryCode: "KR" },
  { slug: "singtel", businessName: "Singapore Telecommunications Ltd", countryCode: "SG" },
  { slug: "starhub", businessName: "StarHub Ltd", countryCode: "SG" },
  { slug: "telkomsel", businessName: "PT Telekomunikasi Selular", countryCode: "ID" },
  { slug: "xl-axiata", businessName: "PT XL Axiata Tbk", countryCode: "ID" },
  { slug: "ais-th", businessName: "Advanced Info Service PCL", countryCode: "TH" },
  { slug: "true-move", businessName: "True Move H Universal Communication", countryCode: "TH" },
  { slug: "mtn-za", businessName: "MTN Group Ltd", countryCode: "ZA" },
  { slug: "vodacom-za", businessName: "Vodacom Group Ltd", countryCode: "ZA" },
];

const CHAT_APPS: ChatApp[] = ["whatsapp", "telegram", "signal"];

function pad(n: number, width = 3): string {
  return String(n).padStart(width, "0");
}

function generateCarrierFixture(
  index: number,
  op: OperatorProfile,
): CarrierFixture {
  const id = pad(index);
  const country = COUNTRIES[op.countryCode];
  if (!country) throw new Error(`unknown countryCode: ${op.countryCode}`);
  const cycle = [15, 30, 45, 60][index % 4]!;
  const due = [15, 30, 45][index % 3]!;
  const slug = op.slug;
  const domain = `${slug}.example.com`;

  return {
    carrier: {
      name: slug,
      businessName: op.businessName,
      ratesName: `Rates Manager ${id}`,
      ratesEmail: `rates@${domain}`,
      billingName: `Billing Manager ${id}`,
      billingEmail: `billing@${domain}`,
      nocName: `${op.businessName} NOC`,
      nocEmail: `noc@${domain}`,
      salesName: `Sales Lead ${id}`,
      salesEmail: `sales@${domain}`,
      billingDetails: {
        address: {
          line1: `${100 + index} ${country.street}`,
          city: country.city,
          ...(country.state ? { state: country.state } : {}),
          postalCode: country.postalCode,
          countryCode: op.countryCode,
        },
        taxId: `${country.taxPrefix}${1000000000 + index}`,
        billingTerms: { cycleDays: cycle, dueDays: due },
      } satisfies CarrierBillingDetails,
    },
    contacts: [
      {
        chatApp: CHAT_APPS[index % CHAT_APPS.length]!,
        chatId: `${country.phonePrefix}${pad(1000 + index, 7)}`,
      },
    ],
  };
}

function buildGeneratedCarriers(target: number, existing: number): CarrierFixture[] {
  const out: CarrierFixture[] = [];
  for (let i = existing + 1; i <= target; i += 1) {
    const op = OPERATOR_POOL[i - existing - 1];
    if (!op)
      throw new Error(
        `OPERATOR_POOL exhausted at carrier index ${i} (pool size ${OPERATOR_POOL.length})`,
      );
    out.push(generateCarrierFixture(i, op));
  }
  return out;
}

type TrunkAuthType = "ip" | "userpass" | "both";

function buildCarrierTrunks(
  carrierId: string,
  carrierName: string,
  index: number,
): NewVoiceTrunkRow[] {
  const trunkCount = (index % 2) + 1;
  const trunks: NewVoiceTrunkRow[] = [];
  for (let t = 1; t <= trunkCount; t += 1) {
    const authType: TrunkAuthType = ["ip", "userpass", "both"][
      (index + t) % 3
    ] as TrunkAuthType;
    const needsCreds = authType === "userpass" || authType === "both";
    trunks.push({
      carrierId,
      name: `${carrierName}-trunk-${pad(t, 2)}`,
      status: ["active", "active", "testing", "inactive"][
        (index + t) % 4
      ] as schema.VoiceTrunkStatus,
      direction: ["both", "outbound", "inbound"][
        (index + t) % 3
      ] as schema.VoiceTrunkDirection,
      protocol: t === 2 ? "sips" : "sip",
      transport: ["udp", "tcp", "tls"][
        (index + t) % 3
      ] as schema.VoiceTrunkTransport,
      authType,
      username: needsCreds ? `${carrierName}-u${t}` : null,
      passwordEncrypted: needsCreds ? `seed-encrypted-${carrierName}-${t}` : null,
      realm: needsCreds ? `${carrierName}.sip` : null,
      fromUser: `${carrierName}-from`,
      fromDomain: `${carrierName}.sip`,
      registerEnabled: needsCreds && t === 1,
      proxy: `sip.${carrierName}.example.com:5060`,
      expiresSeconds: 3600,
      qualifySeconds: 60,
      maxChannels: 100 + index,
      cpsLimit: 10 + (index % 50),
      maxCallDurationSeconds: 3600 + (index % 4) * 1800,
      capacityLines: 50 + index,
      rtpTimeoutSeconds: [30, 60, 90, 120][index % 4]!,
      codecs: ["PCMA", "PCMU", "G729"],
      dtmfMode: "rfc2833",
      natMode: "no",
      metadata: { seed: true },
    });
  }
  return trunks;
}

function randomOctet(): number {
  return Math.floor(Math.random() * 254) + 1;
}

function randomIp(): string {
  return `${randomOctet()}.${randomOctet()}.${randomOctet()}.${randomOctet()}`;
}

function randomTechPrefix(): string {
  const len = 2 + Math.floor(Math.random() * 4);
  let out = "";
  for (let i = 0; i < len; i += 1) {
    out += Math.floor(Math.random() * 10).toString();
  }
  return out;
}

async function seedTrunkIps(trunkId: string, trunkName: string): Promise<void> {
  const existing = await db
    .select({ id: schema.voiceTrunkIps.id })
    .from(schema.voiceTrunkIps)
    .where(
      and(
        eq(schema.voiceTrunkIps.voiceTrunkId, trunkId),
        isNull(schema.voiceTrunkIps.deletedAt),
      ),
    )
    .limit(1);
  if (existing[0]) {
    console.log(`voice_trunk_ips exist: ${trunkName}`);
    return;
  }

  const count = 1 + Math.floor(Math.random() * 5);
  const seenIps = new Set<string>();
  const rows: schema.NewVoiceTrunkIpRow[] = [];
  while (rows.length < count) {
    const ip = randomIp();
    const prefix = Math.random() < 0.5 ? randomTechPrefix() : null;
    const key = `${ip}|${prefix ?? ""}`;
    if (seenIps.has(key)) continue;
    seenIps.add(key);
    rows.push({
      voiceTrunkId: trunkId,
      ip,
      prefix,
      status: Math.random() < 0.95 ? "active" : "inactive",
    });
  }
  await db.insert(schema.voiceTrunkIps).values(rows);
  console.log(`voice_trunk_ips created: ${trunkName} (${rows.length})`);
}

async function seedCarrierTrunks(
  carrierId: string,
  carrierName: string,
  index: number,
): Promise<void> {
  for (const trunk of buildCarrierTrunks(carrierId, carrierName, index)) {
    const existing = await db
      .select()
      .from(schema.voiceTrunks)
      .where(
        and(
          eq(schema.voiceTrunks.carrierId, carrierId),
          eq(schema.voiceTrunks.name, trunk.name),
          isNull(schema.voiceTrunks.deletedAt),
        ),
      )
      .limit(1);
    let trunkId: string;
    if (existing[0]) {
      trunkId = existing[0].id;
      console.log(`voice_trunk exists: ${trunk.name}`);
    } else {
      const [created] = await db
        .insert(schema.voiceTrunks)
        .values(trunk)
        .returning({ id: schema.voiceTrunks.id });
      if (!created) throw new Error(`failed to create voice_trunk: ${trunk.name}`);
      trunkId = created.id;
      console.log(`voice_trunk created: ${trunk.name}`);
    }
    await seedTrunkIps(trunkId, trunk.name);
  }
}

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
  const allCarriers = [
    ...CARRIERS,
    ...buildGeneratedCarriers(100, CARRIERS.length),
  ];
  for (let i = 0; i < allCarriers.length; i += 1) {
    const fixture = allCarriers[i]!;
    const carrierId = await seedCarrier(fixture);
    await seedCarrierTrunks(carrierId, fixture.carrier.name, i + 1);
  }
  await seedAdminChatContacts();
  await seedCountries(db);
  await seedVoiceNumberingPlan(db);
  await seedVoiceRateSheets(db);
  await seedAtVoiceRanges(db);
  await seedAtVoiceNumbers(db);
  console.log("seed complete");
}

try {
  await main();
} finally {
  await pool.end();
}
