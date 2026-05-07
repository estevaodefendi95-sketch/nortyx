
-- Função para verificar se usuário é membro de uma organização específica
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND organization_id = _org_id
  )
$$;

-- billing_clients
DROP POLICY IF EXISTS "Org members can read billing_clients" ON public.billing_clients;
DROP POLICY IF EXISTS "Org members can insert billing_clients" ON public.billing_clients;
DROP POLICY IF EXISTS "Org members can update billing_clients" ON public.billing_clients;
DROP POLICY IF EXISTS "Org members can delete billing_clients" ON public.billing_clients;

CREATE POLICY "Org members can read billing_clients" ON public.billing_clients FOR SELECT TO authenticated
  USING (organization_id IS NULL OR public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can insert billing_clients" ON public.billing_clients FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can update billing_clients" ON public.billing_clients FOR UPDATE TO authenticated
  USING (organization_id IS NULL OR public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can delete billing_clients" ON public.billing_clients FOR DELETE TO authenticated
  USING (organization_id IS NULL OR public.is_org_member(auth.uid(), organization_id));

-- billing_charges
DROP POLICY IF EXISTS "Org members can read billing_charges" ON public.billing_charges;
DROP POLICY IF EXISTS "Org members can insert billing_charges" ON public.billing_charges;
DROP POLICY IF EXISTS "Org members can update billing_charges" ON public.billing_charges;
DROP POLICY IF EXISTS "Org members can delete billing_charges" ON public.billing_charges;

CREATE POLICY "Org members can read billing_charges" ON public.billing_charges FOR SELECT TO authenticated
  USING (organization_id IS NULL OR public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can insert billing_charges" ON public.billing_charges FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can update billing_charges" ON public.billing_charges FOR UPDATE TO authenticated
  USING (organization_id IS NULL OR public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can delete billing_charges" ON public.billing_charges FOR DELETE TO authenticated
  USING (organization_id IS NULL OR public.is_org_member(auth.uid(), organization_id));
