CREATE TYPE "public"."at_voice_termination_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."carrier_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."chat_app" AS ENUM('whatsapp', 'telegram', 'signal');--> statement-breakpoint
CREATE TYPE "public"."currency" AS ENUM('usd', 'eur', 'gbp');--> statement-breakpoint
CREATE TYPE "public"."voice_numbering_plan_destination_type" AS ENUM('landline', 'mobile', 'premium', 'special', 'toll_free', 'shared_cost', 'satellite', 'personal', 'paging', 'voip', 'ngn');--> statement-breakpoint
CREATE TYPE "public"."voice_numbering_plan_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."voice_rate_sheet_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."voice_trunk_auth_type" AS ENUM('ip', 'userpass', 'both');--> statement-breakpoint
CREATE TYPE "public"."voice_trunk_direction" AS ENUM('inbound', 'outbound', 'both');--> statement-breakpoint
CREATE TYPE "public"."voice_trunk_dtmf_mode" AS ENUM('rfc2833', 'inband', 'info');--> statement-breakpoint
CREATE TYPE "public"."voice_trunk_nat_mode" AS ENUM('no', 'yes', 'force_rport', 'comedia');--> statement-breakpoint
CREATE TYPE "public"."voice_trunk_protocol" AS ENUM('sip', 'sips');--> statement-breakpoint
CREATE TYPE "public"."voice_trunk_status" AS ENUM('active', 'inactive', 'testing');--> statement-breakpoint
CREATE TYPE "public"."voice_trunk_transport" AS ENUM('udp', 'tcp', 'tls');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "at_voice_numbers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"at_voice_termination_id" uuid NOT NULL,
	"number" text NOT NULL,
	"last_successful_attempt_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "at_voice_terminations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "at_voice_termination_status" DEFAULT 'active' NOT NULL,
	"carrier_id" uuid NOT NULL,
	"name" text NOT NULL,
	"internal_route_name" text NOT NULL,
	"currency" "currency" NOT NULL,
	"country_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "at_voice_terminations_country_code_iso2" CHECK ("at_voice_terminations"."country_code" ~ '^[A-Z]{2}$')
);
--> statement-breakpoint
CREATE TABLE "carriers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"business_name" text NOT NULL,
	"status" "carrier_status" DEFAULT 'active' NOT NULL,
	"billing_details" jsonb NOT NULL,
	"rates_name" text NOT NULL,
	"rates_email" text NOT NULL,
	"billing_name" text NOT NULL,
	"billing_email" text NOT NULL,
	"noc_name" text NOT NULL,
	"noc_email" text NOT NULL,
	"sales_name" text NOT NULL,
	"sales_email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "chat_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"carrier_id" uuid,
	"chat_app" "chat_app" NOT NULL,
	"chat_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chat_contacts_owner_xor" CHECK ((("chat_contacts"."user_id" IS NOT NULL)::int + ("chat_contacts"."carrier_id" IS NOT NULL)::int) = 1)
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "role_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "voice_cdrs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"duration_secs" integer NOT NULL,
	"buy_currency" "currency" NOT NULL,
	"buy_rate" numeric(18, 6) NOT NULL,
	"sell_currency" "currency" NOT NULL,
	"sell_rate" numeric(18, 6) NOT NULL,
	"internal_route_name" text NOT NULL,
	"inbound_route_name" text,
	"outbound_route_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "voice_cdrs_duration_non_negative" CHECK ("voice_cdrs"."duration_secs" >= 0),
	CONSTRAINT "voice_cdrs_ended_after_started" CHECK ("voice_cdrs"."ended_at" IS NULL OR "voice_cdrs"."ended_at" >= "voice_cdrs"."started_at")
);
--> statement-breakpoint
CREATE TABLE "voice_numbering_plan_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"voice_numbering_plan_destination_id" uuid NOT NULL,
	"code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "voice_numbering_plan_codes_code_digits" CHECK ("voice_numbering_plan_codes"."code" ~ '^[0-9]+$')
);
--> statement-breakpoint
CREATE TABLE "voice_numbering_plan_destinations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"voice_numbering_plan_id" uuid NOT NULL,
	"country_code" text NOT NULL,
	"name" text NOT NULL,
	"type" "voice_numbering_plan_destination_type",
	"website" text,
	"min_digits" integer NOT NULL,
	"max_digits" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "voice_numbering_plan_destinations_country_code_iso2" CHECK ("voice_numbering_plan_destinations"."country_code" ~ '^[A-Z]{2}$'),
	CONSTRAINT "voice_numbering_plan_destinations_min_digits_positive" CHECK ("voice_numbering_plan_destinations"."min_digits" > 0),
	CONSTRAINT "voice_numbering_plan_destinations_max_digits_positive" CHECK ("voice_numbering_plan_destinations"."max_digits" > 0),
	CONSTRAINT "voice_numbering_plan_destinations_digits_range" CHECK ("voice_numbering_plan_destinations"."min_digits" <= "voice_numbering_plan_destinations"."max_digits")
);
--> statement-breakpoint
CREATE TABLE "voice_numbering_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"status" "voice_numbering_plan_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "voice_rate_sheets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"status" "voice_rate_sheet_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "voice_trunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"carrier_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" "voice_trunk_status" DEFAULT 'active' NOT NULL,
	"direction" "voice_trunk_direction" DEFAULT 'both' NOT NULL,
	"protocol" "voice_trunk_protocol" DEFAULT 'sip' NOT NULL,
	"transport" "voice_trunk_transport" DEFAULT 'udp' NOT NULL,
	"host" text NOT NULL,
	"port" integer DEFAULT 5060 NOT NULL,
	"auth_type" "voice_trunk_auth_type" NOT NULL,
	"username" text,
	"password_encrypted" text,
	"realm" text,
	"from_user" text,
	"from_domain" text,
	"register" boolean DEFAULT false NOT NULL,
	"proxy" text,
	"expires_seconds" integer,
	"qualify_seconds" integer,
	"max_channels" integer,
	"cps_limit" integer,
	"codecs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"dtmf_mode" "voice_trunk_dtmf_mode" DEFAULT 'rfc2833' NOT NULL,
	"nat_mode" "voice_trunk_nat_mode" DEFAULT 'no' NOT NULL,
	"ip_acl" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "voice_trunks_port_range" CHECK ("voice_trunks"."port" BETWEEN 1 AND 65535),
	CONSTRAINT "voice_trunks_auth_userpass_complete" CHECK ("voice_trunks"."auth_type" NOT IN ('userpass','both') OR ("voice_trunks"."username" IS NOT NULL AND "voice_trunks"."password_encrypted" IS NOT NULL)),
	CONSTRAINT "voice_trunks_auth_ip_complete" CHECK ("voice_trunks"."auth_type" NOT IN ('ip','both') OR ("voice_trunks"."ip_acl" IS NOT NULL AND jsonb_array_length("voice_trunks"."ip_acl") > 0)),
	CONSTRAINT "voice_trunks_max_channels_positive" CHECK ("voice_trunks"."max_channels" IS NULL OR "voice_trunks"."max_channels" > 0),
	CONSTRAINT "voice_trunks_cps_limit_positive" CHECK ("voice_trunks"."cps_limit" IS NULL OR "voice_trunks"."cps_limit" > 0)
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "at_voice_numbers" ADD CONSTRAINT "at_voice_numbers_at_voice_termination_id_fk" FOREIGN KEY ("at_voice_termination_id") REFERENCES "public"."at_voice_terminations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "at_voice_terminations" ADD CONSTRAINT "at_voice_terminations_carrier_id_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_contacts" ADD CONSTRAINT "chat_contacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_contacts" ADD CONSTRAINT "chat_contacts_carrier_id_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_numbering_plan_codes" ADD CONSTRAINT "voice_numbering_plan_codes_voice_numbering_plan_destination_id_voice_numbering_plan_destinations_id_fk" FOREIGN KEY ("voice_numbering_plan_destination_id") REFERENCES "public"."voice_numbering_plan_destinations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_numbering_plan_destinations" ADD CONSTRAINT "voice_numbering_plan_destinations_voice_numbering_plan_id_voice_numbering_plans_id_fk" FOREIGN KEY ("voice_numbering_plan_id") REFERENCES "public"."voice_numbering_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_trunks" ADD CONSTRAINT "voice_trunks_carrier_id_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_provider_account_unique_active" ON "accounts" USING btree ("provider_id","account_id") WHERE "accounts"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "accounts_user_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "accounts_deleted_at_idx" ON "accounts" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "at_voice_numbers_number_unique_active" ON "at_voice_numbers" USING btree ("number") WHERE "at_voice_numbers"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "at_voice_numbers_at_voice_termination_idx" ON "at_voice_numbers" USING btree ("at_voice_termination_id");--> statement-breakpoint
CREATE INDEX "at_voice_numbers_last_success_idx" ON "at_voice_numbers" USING btree ("last_successful_attempt_at");--> statement-breakpoint
CREATE INDEX "at_voice_numbers_deleted_at_idx" ON "at_voice_numbers" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "at_voice_terminations_carrier_internal_unique_active" ON "at_voice_terminations" USING btree ("carrier_id","internal_route_name") WHERE "at_voice_terminations"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "at_voice_terminations_carrier_idx" ON "at_voice_terminations" USING btree ("carrier_id");--> statement-breakpoint
CREATE INDEX "at_voice_terminations_status_idx" ON "at_voice_terminations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "at_voice_terminations_country_idx" ON "at_voice_terminations" USING btree ("country_code");--> statement-breakpoint
CREATE INDEX "at_voice_terminations_deleted_at_idx" ON "at_voice_terminations" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "carriers_name_unique_active" ON "carriers" USING btree ("name") WHERE "carriers"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "carriers_status_idx" ON "carriers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "carriers_deleted_at_idx" ON "carriers" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "chat_contacts_user_idx" ON "chat_contacts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chat_contacts_carrier_idx" ON "chat_contacts" USING btree ("carrier_id");--> statement-breakpoint
CREATE INDEX "chat_contacts_app_id_idx" ON "chat_contacts" USING btree ("chat_app","chat_id");--> statement-breakpoint
CREATE INDEX "chat_contacts_deleted_at_idx" ON "chat_contacts" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "permissions_key_unique_active" ON "permissions" USING btree ("key") WHERE "permissions"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "permissions_deleted_at_idx" ON "permissions" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "role_permissions_permission_idx" ON "role_permissions" USING btree ("permission_id");--> statement-breakpoint
CREATE INDEX "role_permissions_deleted_at_idx" ON "role_permissions" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_name_unique_active" ON "roles" USING btree ("name") WHERE "roles"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "roles_deleted_at_idx" ON "roles" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_unique_active" ON "sessions" USING btree ("token") WHERE "sessions"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "sessions_deleted_at_idx" ON "sessions" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "user_roles_role_idx" ON "user_roles" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "user_roles_deleted_at_idx" ON "user_roles" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique_active" ON "users" USING btree ("email") WHERE "users"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "users_deleted_at_idx" ON "users" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "verifications_expires_at_idx" ON "verifications" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "verifications_deleted_at_idx" ON "verifications" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "voice_cdrs_started_at_idx" ON "voice_cdrs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "voice_cdrs_internal_route_idx" ON "voice_cdrs" USING btree ("internal_route_name");--> statement-breakpoint
CREATE INDEX "voice_cdrs_deleted_at_idx" ON "voice_cdrs" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "voice_numbering_plan_codes_destination_code_unique_active" ON "voice_numbering_plan_codes" USING btree ("voice_numbering_plan_destination_id","code") WHERE "voice_numbering_plan_codes"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "voice_numbering_plan_codes_destination_idx" ON "voice_numbering_plan_codes" USING btree ("voice_numbering_plan_destination_id");--> statement-breakpoint
CREATE INDEX "voice_numbering_plan_codes_code_idx" ON "voice_numbering_plan_codes" USING btree ("code");--> statement-breakpoint
CREATE INDEX "voice_numbering_plan_codes_deleted_at_idx" ON "voice_numbering_plan_codes" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "voice_numbering_plan_destinations_plan_country_name_unique_active" ON "voice_numbering_plan_destinations" USING btree ("voice_numbering_plan_id","country_code","name") WHERE "voice_numbering_plan_destinations"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "voice_numbering_plan_destinations_plan_idx" ON "voice_numbering_plan_destinations" USING btree ("voice_numbering_plan_id");--> statement-breakpoint
CREATE INDEX "voice_numbering_plan_destinations_country_idx" ON "voice_numbering_plan_destinations" USING btree ("country_code");--> statement-breakpoint
CREATE INDEX "voice_numbering_plan_destinations_deleted_at_idx" ON "voice_numbering_plan_destinations" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "voice_numbering_plans_name_unique_active" ON "voice_numbering_plans" USING btree ("name") WHERE "voice_numbering_plans"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "voice_numbering_plans_status_idx" ON "voice_numbering_plans" USING btree ("status");--> statement-breakpoint
CREATE INDEX "voice_numbering_plans_deleted_at_idx" ON "voice_numbering_plans" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "voice_rate_sheets_name_unique_active" ON "voice_rate_sheets" USING btree ("name") WHERE "voice_rate_sheets"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "voice_rate_sheets_status_idx" ON "voice_rate_sheets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "voice_rate_sheets_deleted_at_idx" ON "voice_rate_sheets" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "voice_trunks_carrier_name_unique_active" ON "voice_trunks" USING btree ("carrier_id","name") WHERE "voice_trunks"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "voice_trunks_carrier_idx" ON "voice_trunks" USING btree ("carrier_id");--> statement-breakpoint
CREATE INDEX "voice_trunks_status_idx" ON "voice_trunks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "voice_trunks_deleted_at_idx" ON "voice_trunks" USING btree ("deleted_at");