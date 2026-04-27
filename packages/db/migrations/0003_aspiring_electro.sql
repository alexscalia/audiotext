CREATE TYPE "public"."chat_app" AS ENUM('whatsapp', 'telegram', 'signal');--> statement-breakpoint
CREATE TABLE "chat_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"carrier_id" uuid,
	"chat_app" "chat_app" NOT NULL,
	"chat_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chat_contacts_owner_xor" CHECK ((("chat_contacts"."user_id" IS NOT NULL)::int + ("chat_contacts"."carrier_id" IS NOT NULL)::int) = 1)
);
--> statement-breakpoint
ALTER TABLE "chat_contacts" ADD CONSTRAINT "chat_contacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_contacts" ADD CONSTRAINT "chat_contacts_carrier_id_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_contacts_user_idx" ON "chat_contacts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chat_contacts_carrier_idx" ON "chat_contacts" USING btree ("carrier_id");--> statement-breakpoint
CREATE INDEX "chat_contacts_app_id_idx" ON "chat_contacts" USING btree ("chat_app","chat_id");--> statement-breakpoint
CREATE INDEX "chat_contacts_deleted_at_idx" ON "chat_contacts" USING btree ("deleted_at");