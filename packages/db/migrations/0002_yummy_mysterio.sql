ALTER TABLE "voice_trunks" ADD COLUMN "max_call_duration_seconds" integer;--> statement-breakpoint
ALTER TABLE "voice_trunks" ADD COLUMN "capacity_lines" integer;--> statement-breakpoint
ALTER TABLE "voice_trunks" ADD COLUMN "rtp_timeout_seconds" integer;--> statement-breakpoint
ALTER TABLE "voice_trunks" ADD CONSTRAINT "voice_trunks_max_call_duration_positive" CHECK ("voice_trunks"."max_call_duration_seconds" IS NULL OR "voice_trunks"."max_call_duration_seconds" > 0);--> statement-breakpoint
ALTER TABLE "voice_trunks" ADD CONSTRAINT "voice_trunks_capacity_lines_positive" CHECK ("voice_trunks"."capacity_lines" IS NULL OR "voice_trunks"."capacity_lines" > 0);--> statement-breakpoint
ALTER TABLE "voice_trunks" ADD CONSTRAINT "voice_trunks_rtp_timeout_positive" CHECK ("voice_trunks"."rtp_timeout_seconds" IS NULL OR "voice_trunks"."rtp_timeout_seconds" > 0);