CREATE TYPE "public"."user_status" AS ENUM('active', 'pending', 'inactive', 'suspended', 'banned');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "status" "user_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");