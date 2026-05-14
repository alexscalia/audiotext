CREATE TYPE "public"."voice_trunk_ip_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TABLE "voice_trunk_ips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"voice_trunk_id" uuid NOT NULL,
	"ip" text NOT NULL,
	"prefix" text,
	"status" "voice_trunk_ip_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "voice_trunk_ips" ADD CONSTRAINT "voice_trunk_ips_voice_trunk_id_voice_trunks_id_fk" FOREIGN KEY ("voice_trunk_id") REFERENCES "public"."voice_trunks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "voice_trunk_ips_trunk_ip_prefix_unique_active" ON "voice_trunk_ips" USING btree ("voice_trunk_id","ip","prefix") WHERE "voice_trunk_ips"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "voice_trunk_ips_trunk_idx" ON "voice_trunk_ips" USING btree ("voice_trunk_id");--> statement-breakpoint
CREATE INDEX "voice_trunk_ips_status_idx" ON "voice_trunk_ips" USING btree ("status");--> statement-breakpoint
CREATE INDEX "voice_trunk_ips_deleted_at_idx" ON "voice_trunk_ips" USING btree ("deleted_at");