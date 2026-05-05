CREATE TYPE "public"."role_scope" AS ENUM('admin', 'user');--> statement-breakpoint
DROP INDEX "roles_name_unique_active";--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "scope" "role_scope";--> statement-breakpoint
UPDATE "roles" SET "scope" = 'admin' WHERE "scope" IS NULL;--> statement-breakpoint
ALTER TABLE "roles" ALTER COLUMN "scope" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "roles_scope_name_unique_active" ON "roles" USING btree ("scope","name") WHERE "roles"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "roles_scope_idx" ON "roles" USING btree ("scope");