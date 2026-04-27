CREATE TYPE "public"."trunk_auth_type" AS ENUM('ip', 'userpass', 'both');--> statement-breakpoint
CREATE TYPE "public"."trunk_direction" AS ENUM('inbound', 'outbound', 'both');--> statement-breakpoint
CREATE TYPE "public"."trunk_dtmf_mode" AS ENUM('rfc2833', 'inband', 'info');--> statement-breakpoint
CREATE TYPE "public"."trunk_nat_mode" AS ENUM('no', 'yes', 'force_rport', 'comedia');--> statement-breakpoint
CREATE TYPE "public"."trunk_protocol" AS ENUM('sip', 'sips');--> statement-breakpoint
CREATE TYPE "public"."trunk_status" AS ENUM('active', 'inactive', 'testing');--> statement-breakpoint
CREATE TYPE "public"."trunk_transport" AS ENUM('udp', 'tcp', 'tls');--> statement-breakpoint
CREATE TABLE "trunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"carrier_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" "trunk_status" DEFAULT 'active' NOT NULL,
	"direction" "trunk_direction" DEFAULT 'both' NOT NULL,
	"protocol" "trunk_protocol" DEFAULT 'sip' NOT NULL,
	"transport" "trunk_transport" DEFAULT 'udp' NOT NULL,
	"host" text NOT NULL,
	"port" integer DEFAULT 5060 NOT NULL,
	"auth_type" "trunk_auth_type" NOT NULL,
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
	"dtmf_mode" "trunk_dtmf_mode" DEFAULT 'rfc2833' NOT NULL,
	"nat_mode" "trunk_nat_mode" DEFAULT 'no' NOT NULL,
	"ip_acl" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "trunks_port_range" CHECK ("trunks"."port" BETWEEN 1 AND 65535),
	CONSTRAINT "trunks_auth_userpass_complete" CHECK ("trunks"."auth_type" NOT IN ('userpass','both') OR ("trunks"."username" IS NOT NULL AND "trunks"."password_encrypted" IS NOT NULL)),
	CONSTRAINT "trunks_auth_ip_complete" CHECK ("trunks"."auth_type" NOT IN ('ip','both') OR ("trunks"."ip_acl" IS NOT NULL AND jsonb_array_length("trunks"."ip_acl") > 0)),
	CONSTRAINT "trunks_max_channels_positive" CHECK ("trunks"."max_channels" IS NULL OR "trunks"."max_channels" > 0),
	CONSTRAINT "trunks_cps_limit_positive" CHECK ("trunks"."cps_limit" IS NULL OR "trunks"."cps_limit" > 0)
);
--> statement-breakpoint
ALTER TABLE "trunks" ADD CONSTRAINT "trunks_carrier_id_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "trunks_carrier_name_unique_active" ON "trunks" USING btree ("carrier_id","name") WHERE "trunks"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "trunks_carrier_idx" ON "trunks" USING btree ("carrier_id");--> statement-breakpoint
CREATE INDEX "trunks_status_idx" ON "trunks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "trunks_deleted_at_idx" ON "trunks" USING btree ("deleted_at");