CREATE TABLE "at_termination_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"at_voice_termination_id" uuid NOT NULL,
	"idle_revoke_hours" integer NOT NULL,
	"assigned_numbers_count" integer DEFAULT 0 NOT NULL,
	"max_assigned_numbers" integer DEFAULT 10 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "at_termination_users_idle_revoke_hours_positive" CHECK ("at_termination_users"."idle_revoke_hours" > 0),
	CONSTRAINT "at_termination_users_max_assigned_numbers_positive" CHECK ("at_termination_users"."max_assigned_numbers" > 0),
	CONSTRAINT "at_termination_users_assigned_count_nonneg" CHECK ("at_termination_users"."assigned_numbers_count" >= 0),
	CONSTRAINT "at_termination_users_count_within_max" CHECK ("at_termination_users"."assigned_numbers_count" <= "at_termination_users"."max_assigned_numbers")
);
--> statement-breakpoint
ALTER TABLE "at_termination_users" ADD CONSTRAINT "at_termination_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "at_termination_users" ADD CONSTRAINT "at_termination_users_at_voice_termination_id_at_voice_terminations_id_fk" FOREIGN KEY ("at_voice_termination_id") REFERENCES "public"."at_voice_terminations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "at_termination_users_user_termination_unique_active" ON "at_termination_users" USING btree ("user_id","at_voice_termination_id") WHERE "at_termination_users"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "at_termination_users_user_idx" ON "at_termination_users" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "at_termination_users_termination_idx" ON "at_termination_users" USING btree ("at_voice_termination_id");--> statement-breakpoint
CREATE INDEX "at_termination_users_deleted_at_idx" ON "at_termination_users" USING btree ("deleted_at");