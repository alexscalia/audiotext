CREATE TYPE "public"."currency" AS ENUM('usd', 'eur', 'gbp');--> statement-breakpoint
CREATE TYPE "public"."termination_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TABLE "terminations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "termination_status" DEFAULT 'active' NOT NULL,
	"carrier_id" uuid NOT NULL,
	"name" text NOT NULL,
	"internal_route_name" text NOT NULL,
	"carrier_route_name" text NOT NULL,
	"currency" "currency" NOT NULL,
	"country_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "terminations_country_code_iso2" CHECK ("terminations"."country_code" ~ '^[A-Z]{2}$')
);
--> statement-breakpoint
ALTER TABLE "terminations" ADD CONSTRAINT "terminations_carrier_id_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "terminations_carrier_internal_unique_active" ON "terminations" USING btree ("carrier_id","internal_route_name") WHERE "terminations"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "terminations_carrier_idx" ON "terminations" USING btree ("carrier_id");--> statement-breakpoint
CREATE INDEX "terminations_status_idx" ON "terminations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "terminations_country_idx" ON "terminations" USING btree ("country_code");--> statement-breakpoint
CREATE INDEX "terminations_deleted_at_idx" ON "terminations" USING btree ("deleted_at");