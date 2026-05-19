ALTER TABLE "voice_trunk_ips" ADD COLUMN "source_cidr" text;
--> statement-breakpoint
CREATE INDEX "voice_trunk_ips_source_cidr_idx"
  ON "voice_trunk_ips" ("voice_trunk_id", "source_cidr")
  WHERE "deleted_at" IS NULL;
