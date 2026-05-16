CREATE TYPE "public"."voice_blocked_number_party" AS ENUM('a', 'b');--> statement-breakpoint
CREATE TABLE "at_voice_termination_blocked_prefixes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"at_voice_termination_id" uuid,
	"party" "voice_blocked_number_party" NOT NULL,
	"number_prefix" text NOT NULL,
	"reason" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "at_voice_termination_blocked_prefixes_number_prefix_digits" CHECK ("at_voice_termination_blocked_prefixes"."number_prefix" ~ '^[0-9]+$'),
	CONSTRAINT "at_voice_termination_blocked_prefixes_expires_after_created" CHECK ("at_voice_termination_blocked_prefixes"."expires_at" IS NULL OR "at_voice_termination_blocked_prefixes"."expires_at" > "at_voice_termination_blocked_prefixes"."created_at")
);
--> statement-breakpoint
CREATE TABLE "voice_trunk_blocked_prefixes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"voice_trunk_id" uuid,
	"party" "voice_blocked_number_party" NOT NULL,
	"number_prefix" text NOT NULL,
	"reason" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "voice_trunk_blocked_prefixes_number_prefix_digits" CHECK ("voice_trunk_blocked_prefixes"."number_prefix" ~ '^[0-9]+$'),
	CONSTRAINT "voice_trunk_blocked_prefixes_expires_after_created" CHECK ("voice_trunk_blocked_prefixes"."expires_at" IS NULL OR "voice_trunk_blocked_prefixes"."expires_at" > "voice_trunk_blocked_prefixes"."created_at")
);
--> statement-breakpoint
ALTER TABLE "carriers" ADD COLUMN "timezone" text DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
ALTER TABLE "at_voice_termination_blocked_prefixes" ADD CONSTRAINT "at_voice_termination_blocked_prefixes_at_voice_termination_id_at_voice_terminations_id_fk" FOREIGN KEY ("at_voice_termination_id") REFERENCES "public"."at_voice_terminations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_trunk_blocked_prefixes" ADD CONSTRAINT "voice_trunk_blocked_prefixes_voice_trunk_id_voice_trunks_id_fk" FOREIGN KEY ("voice_trunk_id") REFERENCES "public"."voice_trunks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "at_voice_termination_blocked_prefixes_scoped_unique_active" ON "at_voice_termination_blocked_prefixes" USING btree ("at_voice_termination_id","party","number_prefix") WHERE "at_voice_termination_blocked_prefixes"."deleted_at" IS NULL AND "at_voice_termination_blocked_prefixes"."at_voice_termination_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "at_voice_termination_blocked_prefixes_global_unique_active" ON "at_voice_termination_blocked_prefixes" USING btree ("party","number_prefix") WHERE "at_voice_termination_blocked_prefixes"."deleted_at" IS NULL AND "at_voice_termination_blocked_prefixes"."at_voice_termination_id" IS NULL;--> statement-breakpoint
CREATE INDEX "at_voice_termination_blocked_prefixes_termination_idx" ON "at_voice_termination_blocked_prefixes" USING btree ("at_voice_termination_id");--> statement-breakpoint
CREATE INDEX "at_voice_termination_blocked_prefixes_party_prefix_idx" ON "at_voice_termination_blocked_prefixes" USING btree ("party","number_prefix");--> statement-breakpoint
CREATE INDEX "at_voice_termination_blocked_prefixes_expires_at_idx" ON "at_voice_termination_blocked_prefixes" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "at_voice_termination_blocked_prefixes_deleted_at_idx" ON "at_voice_termination_blocked_prefixes" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "voice_trunk_blocked_prefixes_scoped_unique_active" ON "voice_trunk_blocked_prefixes" USING btree ("voice_trunk_id","party","number_prefix") WHERE "voice_trunk_blocked_prefixes"."deleted_at" IS NULL AND "voice_trunk_blocked_prefixes"."voice_trunk_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "voice_trunk_blocked_prefixes_global_unique_active" ON "voice_trunk_blocked_prefixes" USING btree ("party","number_prefix") WHERE "voice_trunk_blocked_prefixes"."deleted_at" IS NULL AND "voice_trunk_blocked_prefixes"."voice_trunk_id" IS NULL;--> statement-breakpoint
CREATE INDEX "voice_trunk_blocked_prefixes_trunk_idx" ON "voice_trunk_blocked_prefixes" USING btree ("voice_trunk_id");--> statement-breakpoint
CREATE INDEX "voice_trunk_blocked_prefixes_party_prefix_idx" ON "voice_trunk_blocked_prefixes" USING btree ("party","number_prefix");--> statement-breakpoint
CREATE INDEX "voice_trunk_blocked_prefixes_expires_at_idx" ON "voice_trunk_blocked_prefixes" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "voice_trunk_blocked_prefixes_deleted_at_idx" ON "voice_trunk_blocked_prefixes" USING btree ("deleted_at");