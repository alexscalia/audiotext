-- Rule A: treat NULL prefix as a single distinct value so two
-- (voice_trunk_id, ip, NULL) rows cannot coexist. drizzle-orm 0.45.2 cannot
-- express NULLS NOT DISTINCT on a partial unique index, so this migration is
-- hand-authored. Future drizzle upgrade should normalize the schema snapshot.
DROP INDEX IF EXISTS "voice_trunk_ips_trunk_ip_prefix_unique_active";
--> statement-breakpoint
CREATE UNIQUE INDEX "voice_trunk_ips_trunk_ip_prefix_unique_active"
  ON "voice_trunk_ips" ("voice_trunk_id", "ip", "prefix")
  NULLS NOT DISTINCT
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint

-- Rule B: an IP address may only belong to trunks of a single carrier. A
-- unique index cannot span the join to voice_trunks, so enforce via trigger.
-- The trigger raises a 23505 (unique_violation) so it slots cleanly into the
-- existing duplicate-handling path in the API.
CREATE OR REPLACE FUNCTION voice_trunk_ips_check_carrier()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  new_carrier uuid;
  conflict_count integer;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT carrier_id INTO new_carrier
    FROM voice_trunks
    WHERE id = NEW.voice_trunk_id;

  IF new_carrier IS NULL THEN
    -- parent trunk missing; let the FK constraint handle the error
    RETURN NEW;
  END IF;

  SELECT count(*) INTO conflict_count
    FROM voice_trunk_ips vti
    INNER JOIN voice_trunks vt ON vt.id = vti.voice_trunk_id
    WHERE vti.ip = NEW.ip
      AND vti.deleted_at IS NULL
      AND vti.id <> NEW.id
      AND vt.carrier_id <> new_carrier;

  IF conflict_count > 0 THEN
    RAISE EXCEPTION 'ip_owned_by_other_carrier'
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER voice_trunk_ips_carrier_guard
  BEFORE INSERT OR UPDATE ON voice_trunk_ips
  FOR EACH ROW EXECUTE FUNCTION voice_trunk_ips_check_carrier();
