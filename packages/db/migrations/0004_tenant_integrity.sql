-- Enforce matching tenant keys across FK links without adding competing
-- relationships that would make embedded selections ambiguous.
CREATE FUNCTION app_private.assert_tenant_links() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE f record; parent jsonb; payload jsonb; company text; outlet text; key_value text;
BEGIN
  payload := to_jsonb(NEW);
  company := payload ->> 'company_id';
  outlet := payload ->> 'outlet_id';
  FOR f IN SELECT t.relname AS target, a.attname AS column_name
    FROM pg_constraint c JOIN pg_class t ON t.oid = c.confrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.conrelid = TG_RELID AND c.contype = 'f' AND n.nspname = 'public'
    AND array_length(c.conkey,1) = 1 ORDER BY c.conname
  LOOP
    key_value := payload ->> f.column_name;
    IF key_value IS NULL THEN CONTINUE; END IF;
    EXECUTE format('SELECT to_jsonb(p) FROM public.%I p WHERE id=$1::uuid', f.target)
      INTO parent USING key_value;
    IF parent IS NULL THEN RAISE EXCEPTION 'Referenced resource missing or outside tenant scope'; END IF;
    IF parent ->> 'company_id' IS NOT NULL THEN
      IF company IS NOT NULL AND company <> parent ->> 'company_id' THEN RAISE EXCEPTION 'CROSS_TENANT_REFERENCE'; END IF;
      company := parent ->> 'company_id';
    END IF;
    IF parent ->> 'outlet_id' IS NOT NULL THEN
      IF outlet IS NOT NULL AND outlet <> parent ->> 'outlet_id' THEN RAISE EXCEPTION 'CROSS_OUTLET_REFERENCE'; END IF;
      outlet := parent ->> 'outlet_id';
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT conrelid::regclass AS tbl FROM pg_constraint
    WHERE contype='f' AND connamespace='public'::regnamespace
  LOOP
    EXECUTE format('CREATE TRIGGER tenant_links BEFORE INSERT OR UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION app_private.assert_tenant_links()', r.tbl);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION app_private.assert_tenant_links() FROM PUBLIC;
