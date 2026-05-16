CREATE TYPE "public"."voice_blocked_number_party" AS ENUM('a', 'b');--> statement-breakpoint
CREATE TABLE "at_voice_termination_blocked_numbers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"at_voice_termination_id" uuid NOT NULL,
	"party" "voice_blocked_number_party" NOT NULL,
	"number_prefix" text NOT NULL,
	"reason" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "at_voice_termination_blocked_numbers_number_prefix_digits" CHECK ("at_voice_termination_blocked_numbers"."number_prefix" ~ '^[0-9]+$'),
	CONSTRAINT "at_voice_termination_blocked_numbers_expires_after_created" CHECK ("at_voice_termination_blocked_numbers"."expires_at" IS NULL OR "at_voice_termination_blocked_numbers"."expires_at" > "at_voice_termination_blocked_numbers"."created_at")
);
--> statement-breakpoint
CREATE TABLE "voice_trunk_blocked_numbers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"voice_trunk_id" uuid NOT NULL,
	"party" "voice_blocked_number_party" NOT NULL,
	"number_prefix" text NOT NULL,
	"reason" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "voice_trunk_blocked_numbers_number_prefix_digits" CHECK ("voice_trunk_blocked_numbers"."number_prefix" ~ '^[0-9]+$'),
	CONSTRAINT "voice_trunk_blocked_numbers_expires_after_created" CHECK ("voice_trunk_blocked_numbers"."expires_at" IS NULL OR "voice_trunk_blocked_numbers"."expires_at" > "voice_trunk_blocked_numbers"."created_at")
);
--> statement-breakpoint
ALTER TABLE "at_voice_termination_blocked_numbers" ADD CONSTRAINT "at_voice_termination_blocked_numbers_at_voice_termination_id_at_voice_terminations_id_fk" FOREIGN KEY ("at_voice_termination_id") REFERENCES "public"."at_voice_terminations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_trunk_blocked_numbers" ADD CONSTRAINT "voice_trunk_blocked_numbers_voice_trunk_id_voice_trunks_id_fk" FOREIGN KEY ("voice_trunk_id") REFERENCES "public"."voice_trunks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "at_voice_termination_blocked_numbers_termination_party_prefix_unique_active" ON "at_voice_termination_blocked_numbers" USING btree ("at_voice_termination_id","party","number_prefix") WHERE "at_voice_termination_blocked_numbers"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "at_voice_termination_blocked_numbers_termination_idx" ON "at_voice_termination_blocked_numbers" USING btree ("at_voice_termination_id");--> statement-breakpoint
CREATE INDEX "at_voice_termination_blocked_numbers_party_prefix_idx" ON "at_voice_termination_blocked_numbers" USING btree ("party","number_prefix");--> statement-breakpoint
CREATE INDEX "at_voice_termination_blocked_numbers_expires_at_idx" ON "at_voice_termination_blocked_numbers" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "at_voice_termination_blocked_numbers_deleted_at_idx" ON "at_voice_termination_blocked_numbers" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "voice_trunk_blocked_numbers_trunk_party_prefix_unique_active" ON "voice_trunk_blocked_numbers" USING btree ("voice_trunk_id","party","number_prefix") WHERE "voice_trunk_blocked_numbers"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "voice_trunk_blocked_numbers_trunk_idx" ON "voice_trunk_blocked_numbers" USING btree ("voice_trunk_id");--> statement-breakpoint
CREATE INDEX "voice_trunk_blocked_numbers_party_prefix_idx" ON "voice_trunk_blocked_numbers" USING btree ("party","number_prefix");--> statement-breakpoint
CREATE INDEX "voice_trunk_blocked_numbers_expires_at_idx" ON "voice_trunk_blocked_numbers" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "voice_trunk_blocked_numbers_deleted_at_idx" ON "voice_trunk_blocked_numbers" USING btree ("deleted_at");