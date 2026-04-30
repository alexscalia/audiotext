CREATE TABLE "numbering_plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country_code" text NOT NULL,
	"area_code" text,
	"operator_name" text NOT NULL,
	"min_digits" integer NOT NULL,
	"max_digits" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "numbering_plan_country_code_iso2" CHECK ("numbering_plan"."country_code" ~ '^[A-Z]{2}$'),
	CONSTRAINT "numbering_plan_min_digits_positive" CHECK ("numbering_plan"."min_digits" > 0),
	CONSTRAINT "numbering_plan_max_digits_positive" CHECK ("numbering_plan"."max_digits" > 0),
	CONSTRAINT "numbering_plan_digits_range" CHECK ("numbering_plan"."min_digits" <= "numbering_plan"."max_digits")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "numbering_plan_country_area_operator_unique_active" ON "numbering_plan" USING btree ("country_code","area_code","operator_name") WHERE "numbering_plan"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "numbering_plan_country_idx" ON "numbering_plan" USING btree ("country_code");--> statement-breakpoint
CREATE INDEX "numbering_plan_country_area_idx" ON "numbering_plan" USING btree ("country_code","area_code");--> statement-breakpoint
CREATE INDEX "numbering_plan_deleted_at_idx" ON "numbering_plan" USING btree ("deleted_at");