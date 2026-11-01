-- Stable outlet-scoped business identifiers for spreadsheet imports.
ALTER TABLE public.ingredients ADD COLUMN code text;
ALTER TABLE public.products ADD COLUMN code text;

-- Existing installations receive printable codes once; clients/importers can then address them without UUIDs.
UPDATE public.ingredients SET code='BHN-' || upper(substr(replace(id::text,'-',''),1,12)) WHERE code IS NULL;
UPDATE public.products SET code='PRD-' || upper(substr(replace(id::text,'-',''),1,12)) WHERE code IS NULL;

-- Existing POS and internal insert paths that omit the business code receive one automatically.
ALTER TABLE public.ingredients ALTER COLUMN code SET DEFAULT ('BHN-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)));
ALTER TABLE public.products ALTER COLUMN code SET DEFAULT ('PRD-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)));
ALTER TABLE public.ingredients ALTER COLUMN code SET NOT NULL;
ALTER TABLE public.products ALTER COLUMN code SET NOT NULL;

ALTER TABLE public.ingredients ADD CONSTRAINT ingredient_business_code_format
  CHECK (code=btrim(code) AND code ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'
    AND code !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
ALTER TABLE public.products ADD CONSTRAINT product_business_code_format
  CHECK (code=btrim(code) AND code ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'
    AND code !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');

CREATE UNIQUE INDEX ingredients_outlet_business_code_uq
  ON public.ingredients(company_id,outlet_id,lower(code)) WHERE company_id IS NOT NULL AND outlet_id IS NOT NULL;
CREATE UNIQUE INDEX products_outlet_business_code_uq
  ON public.products(company_id,outlet_id,lower(code)) WHERE company_id IS NOT NULL AND outlet_id IS NOT NULL;
