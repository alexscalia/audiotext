CREATE TYPE "public"."numbering_plan_destination_type" AS ENUM('proper', 'mobile', 'premium', 'special', 'toll_free', 'shared_cost', 'satellite', 'personal', 'paging', 'voip', 'ngn');--> statement-breakpoint
ALTER TABLE "numbering_plan_destinations" ADD COLUMN "type" "numbering_plan_destination_type";--> statement-breakpoint
ALTER TABLE "numbering_plan_destinations" ADD COLUMN "website" text;