ALTER TABLE "permissions" DROP CONSTRAINT "permissions_key_unique";--> statement-breakpoint
ALTER TABLE "roles" DROP CONSTRAINT "roles_name_unique";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_email_unique";--> statement-breakpoint
ALTER TABLE "permissions" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "permissions" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_roles" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "user_roles" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "permissions_key_unique_active" ON "permissions" USING btree ("key") WHERE "permissions"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "permissions_deleted_at_idx" ON "permissions" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "role_permissions_deleted_at_idx" ON "role_permissions" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_name_unique_active" ON "roles" USING btree ("name") WHERE "roles"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "roles_deleted_at_idx" ON "roles" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "user_roles_deleted_at_idx" ON "user_roles" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique_active" ON "users" USING btree ("email") WHERE "users"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "users_deleted_at_idx" ON "users" USING btree ("deleted_at");