CREATE TABLE "countries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iso2" text NOT NULL,
	"name_en" text NOT NULL,
	"name_it" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "countries_iso2_format" CHECK ("countries"."iso2" ~ '^[A-Z]{2}$')
);
--> statement-breakpoint
CREATE UNIQUE INDEX "countries_iso2_unique_active" ON "countries" USING btree ("iso2") WHERE "countries"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "countries_iso2_idx" ON "countries" USING btree ("iso2");--> statement-breakpoint
CREATE INDEX "countries_deleted_at_idx" ON "countries" USING btree ("deleted_at");