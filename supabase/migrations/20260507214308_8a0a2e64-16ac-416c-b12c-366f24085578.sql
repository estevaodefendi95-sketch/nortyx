
-- 1. Backfill any null organization_id (no rows currently, but safe)
-- (skipped since no rows exist)

-- 2. Validation trigger: charge.organization_id must match client.organization_id
CREATE OR REPLACE FUNCTION public.validate_billing_charge_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  client_org uuid;
BEGIN
  IF NEW.organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id é obrigatório em billing_charges';
  END IF;
  SELECT organization_id INTO client_org FROM public.billing_clients WHERE id = NEW.client_id;
  IF client_org IS NULL THEN
    -- migrate client to charge org if it has no org
    UPDATE public.billing_clients SET organization_id = NEW.organization_id WHERE id = NEW.client_id;
  ELSIF client_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'Cliente pertence a outra empresa (cliente=%, cobrança=%)', client_org, NEW.organization_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_billing_charge_org ON public.billing_charges;
CREATE TRIGGER trg_validate_billing_charge_org
BEFORE INSERT OR UPDATE ON public.billing_charges
FOR EACH ROW EXECUTE FUNCTION public.validate_billing_charge_org();

-- 3. Super user policies for full management of billing_clients
DROP POLICY IF EXISTS "Super user manage billing_clients" ON public.billing_clients;
CREATE POLICY "Super user manage billing_clients" ON public.billing_clients
FOR ALL TO authenticated
USING (public.is_super_user(auth.uid()))
WITH CHECK (public.is_super_user(auth.uid()));

DROP POLICY IF EXISTS "Super user manage billing_charges" ON public.billing_charges;
CREATE POLICY "Super user manage billing_charges" ON public.billing_charges
FOR ALL TO authenticated
USING (public.is_super_user(auth.uid()))
WITH CHECK (public.is_super_user(auth.uid()));
