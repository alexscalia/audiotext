CREATE TABLE "carriers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"business_name" text NOT NULL,
	"billing_details" jsonb NOT NULL,
	"rates_email" text NOT NULL,
	"billing_email" text NOT NULL,
	"noc_name" text NOT NULL,
	"noc_email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "carriers_name_unique_active" ON "carriers" USING btree ("name") WHERE "carriers"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "carriers_deleted_at_idx" ON "carriers" USING btree ("deleted_at");