CREATE TABLE "dids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"termination_id" uuid NOT NULL,
	"number" text NOT NULL,
	"last_successful_attempt_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "dids" ADD CONSTRAINT "dids_termination_id_terminations_id_fk" FOREIGN KEY ("termination_id") REFERENCES "public"."terminations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "dids_number_unique_active" ON "dids" USING btree ("number") WHERE "dids"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "dids_termination_idx" ON "dids" USING btree ("termination_id");--> statement-breakpoint
CREATE INDEX "dids_last_success_idx" ON "dids" USING btree ("last_successful_attempt_at");--> statement-breakpoint
CREATE INDEX "dids_deleted_at_idx" ON "dids" USING btree ("deleted_at");