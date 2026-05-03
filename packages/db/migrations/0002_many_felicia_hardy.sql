CREATE TABLE "numbering_plan_prefixes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"numbering_plan_destination_id" uuid NOT NULL,
	"prefix" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "numbering_plan_prefixes_prefix_digits" CHECK ("numbering_plan_prefixes"."prefix" ~ '^[0-9]+$')
);
--> statement-breakpoint
ALTER TABLE "numbering_plan_prefixes" ADD CONSTRAINT "numbering_plan_prefixes_numbering_plan_destination_id_numbering_plan_destinations_id_fk" FOREIGN KEY ("numbering_plan_destination_id") REFERENCES "public"."numbering_plan_destinations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "numbering_plan_prefixes_destination_prefix_unique_active" ON "numbering_plan_prefixes" USING btree ("numbering_plan_destination_id","prefix") WHERE "numbering_plan_prefixes"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "numbering_plan_prefixes_destination_idx" ON "numbering_plan_prefixes" USING btree ("numbering_plan_destination_id");--> statement-breakpoint
CREATE INDEX "numbering_plan_prefixes_prefix_idx" ON "numbering_plan_prefixes" USING btree ("prefix");--> statement-breakpoint
CREATE INDEX "numbering_plan_prefixes_deleted_at_idx" ON "numbering_plan_prefixes" USING btree ("deleted_at");