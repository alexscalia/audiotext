ALTER TABLE "voice_cdrs" ADD COLUMN "at_voice_range_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "voice_cdrs" ADD COLUMN "voice_trunk_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "voice_cdrs" ADD COLUMN "a_number" text NOT NULL;--> statement-breakpoint
ALTER TABLE "voice_cdrs" ADD COLUMN "b_number" text NOT NULL;--> statement-breakpoint
ALTER TABLE "voice_cdrs" ADD COLUMN "b_number_dialed" text NOT NULL;--> statement-breakpoint
ALTER TABLE "voice_cdrs" ADD CONSTRAINT "voice_cdrs_at_voice_range_id_at_voice_ranges_id_fk" FOREIGN KEY ("at_voice_range_id") REFERENCES "public"."at_voice_ranges"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_cdrs" ADD CONSTRAINT "voice_cdrs_voice_trunk_id_voice_trunks_id_fk" FOREIGN KEY ("voice_trunk_id") REFERENCES "public"."voice_trunks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "voice_cdrs_range_started_idx" ON "voice_cdrs" USING btree ("at_voice_range_id","started_at");--> statement-breakpoint
CREATE INDEX "voice_cdrs_trunk_started_idx" ON "voice_cdrs" USING btree ("voice_trunk_id","started_at");--> statement-breakpoint
CREATE INDEX "voice_cdrs_a_number_started_idx" ON "voice_cdrs" USING btree ("a_number","started_at");--> statement-breakpoint
CREATE INDEX "voice_cdrs_b_number_started_idx" ON "voice_cdrs" USING btree ("b_number","started_at");