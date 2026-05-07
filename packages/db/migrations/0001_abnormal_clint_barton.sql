CREATE TABLE "voice_rate_sheet_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"voice_rate_sheet_id" uuid NOT NULL,
	"voice_numbering_plan_destination_id" uuid NOT NULL,
	"rate" numeric(18, 6) NOT NULL,
	"billing_initial_increment" integer NOT NULL,
	"billing_subsequent_increment" integer NOT NULL,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "voice_rate_sheet_lines_rate_non_negative" CHECK ("voice_rate_sheet_lines"."rate" >= 0),
	CONSTRAINT "voice_rate_sheet_lines_initial_increment_positive" CHECK ("voice_rate_sheet_lines"."billing_initial_increment" > 0),
	CONSTRAINT "voice_rate_sheet_lines_subsequent_increment_positive" CHECK ("voice_rate_sheet_lines"."billing_subsequent_increment" > 0),
	CONSTRAINT "voice_rate_sheet_lines_valid_range" CHECK ("voice_rate_sheet_lines"."valid_to" IS NULL OR "voice_rate_sheet_lines"."valid_to" > "voice_rate_sheet_lines"."valid_from")
);
--> statement-breakpoint
ALTER TABLE "voice_rate_sheets" ADD COLUMN "voice_numbering_plan_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "voice_rate_sheets" ADD COLUMN "currency_iso" text NOT NULL;--> statement-breakpoint
ALTER TABLE "voice_rate_sheet_lines" ADD CONSTRAINT "voice_rate_sheet_lines_voice_rate_sheet_id_voice_rate_sheets_id_fk" FOREIGN KEY ("voice_rate_sheet_id") REFERENCES "public"."voice_rate_sheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_rate_sheet_lines" ADD CONSTRAINT "voice_rate_sheet_lines_voice_numbering_plan_destination_id_voice_numbering_plan_destinations_id_fk" FOREIGN KEY ("voice_numbering_plan_destination_id") REFERENCES "public"."voice_numbering_plan_destinations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "voice_rate_sheet_lines_voice_rate_sheet_idx" ON "voice_rate_sheet_lines" USING btree ("voice_rate_sheet_id");--> statement-breakpoint
CREATE INDEX "voice_rate_sheet_lines_destination_idx" ON "voice_rate_sheet_lines" USING btree ("voice_numbering_plan_destination_id");--> statement-breakpoint
CREATE INDEX "voice_rate_sheet_lines_valid_from_idx" ON "voice_rate_sheet_lines" USING btree ("valid_from");--> statement-breakpoint
CREATE INDEX "voice_rate_sheet_lines_valid_to_idx" ON "voice_rate_sheet_lines" USING btree ("valid_to");--> statement-breakpoint
CREATE INDEX "voice_rate_sheet_lines_deleted_at_idx" ON "voice_rate_sheet_lines" USING btree ("deleted_at");--> statement-breakpoint
ALTER TABLE "voice_rate_sheets" ADD CONSTRAINT "voice_rate_sheets_voice_numbering_plan_id_voice_numbering_plans_id_fk" FOREIGN KEY ("voice_numbering_plan_id") REFERENCES "public"."voice_numbering_plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "voice_rate_sheets_voice_numbering_plan_idx" ON "voice_rate_sheets" USING btree ("voice_numbering_plan_id");--> statement-breakpoint
ALTER TABLE "voice_rate_sheets" ADD CONSTRAINT "voice_rate_sheets_currency_iso_format" CHECK ("voice_rate_sheets"."currency_iso" ~ '^[A-Z]{3}$');