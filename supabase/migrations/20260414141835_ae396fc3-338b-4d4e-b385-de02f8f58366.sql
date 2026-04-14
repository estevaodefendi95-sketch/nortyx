
-- 1. Create org_role enum
CREATE TYPE public.org_role AS ENUM ('owner', 'admin', 'member', 'viewer');

-- 2. Create organizations table
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text,
  primary_color text NOT NULL DEFAULT '#3B82F6',
  plan text NOT NULL DEFAULT 'free',
  subscription_status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Create organization_members table
CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role org_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- 4. Create get_user_org_id function (returns first org for a user)
CREATE OR REPLACE FUNCTION public.get_user_org_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.organization_members
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- 5. RLS for organizations
CREATE POLICY "Members can view their organization"
  ON public.organizations FOR SELECT TO authenticated
  USING (id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "Owners can update their organization"
  ON public.organizations FOR UPDATE TO authenticated
  USING (id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role = 'owner'))
  WITH CHECK (id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role = 'owner'));

CREATE POLICY "Authenticated can create organizations"
  ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (true);

-- 6. RLS for organization_members
CREATE POLICY "Members can view org members"
  ON public.organization_members FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()));

CREATE POLICY "Owners can manage members"
  ON public.organization_members FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members om WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')));

CREATE POLICY "Owners can update members"
  ON public.organization_members FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members om WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members om WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')));

CREATE POLICY "Owners can delete members"
  ON public.organization_members FOR DELETE TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members om WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')));

CREATE POLICY "Users can insert themselves"
  ON public.organization_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 7. Add organization_id to all data tables (nullable for now to not break existing data)
ALTER TABLE public.transactions ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.daily_incomes ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.categories ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.subcategories ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.fornecedores ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.products ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.notes ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.billing_clients ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.billing_charges ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.push_subscriptions ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.tab_visibility ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.audit_log ADD COLUMN organization_id uuid REFERENCES public.organizations(id);

-- 8. Create indexes for organization_id
CREATE INDEX idx_transactions_org ON public.transactions(organization_id);
CREATE INDEX idx_daily_incomes_org ON public.daily_incomes(organization_id);
CREATE INDEX idx_categories_org ON public.categories(organization_id);
CREATE INDEX idx_subcategories_org ON public.subcategories(organization_id);
CREATE INDEX idx_fornecedores_org ON public.fornecedores(organization_id);
CREATE INDEX idx_products_org ON public.products(organization_id);
CREATE INDEX idx_notes_org ON public.notes(organization_id);
CREATE INDEX idx_billing_clients_org ON public.billing_clients(organization_id);
CREATE INDEX idx_billing_charges_org ON public.billing_charges(organization_id);
CREATE INDEX idx_push_subscriptions_org ON public.push_subscriptions(organization_id);
CREATE INDEX idx_tab_visibility_org ON public.tab_visibility(organization_id);
CREATE INDEX idx_audit_log_org ON public.audit_log(organization_id);
CREATE INDEX idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX idx_org_members_org ON public.organization_members(organization_id);

-- 9. Drop old RLS policies and create new org-scoped ones for data tables

-- TRANSACTIONS
DROP POLICY IF EXISTS "Authenticated users can read transactions" ON public.transactions;
DROP POLICY IF EXISTS "Authenticated users can insert transactions" ON public.transactions;
DROP POLICY IF EXISTS "Authenticated users can update transactions" ON public.transactions;
DROP POLICY IF EXISTS "Authenticated users can delete transactions" ON public.transactions;

CREATE POLICY "Org members can read transactions" ON public.transactions FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) OR organization_id IS NULL);
CREATE POLICY "Org members can insert transactions" ON public.transactions FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_org_id(auth.uid()));
CREATE POLICY "Org members can update transactions" ON public.transactions FOR UPDATE TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) OR organization_id IS NULL);
CREATE POLICY "Org members can delete transactions" ON public.transactions FOR DELETE TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) OR organization_id IS NULL);

-- DAILY_INCOMES
DROP POLICY IF EXISTS "Authenticated users can read daily_incomes" ON public.daily_incomes;
DROP POLICY IF EXISTS "Authenticated users can insert daily_incomes" ON public.daily_incomes;
DROP POLICY IF EXISTS "Authenticated users can update daily_incomes" ON public.daily_incomes;
DROP POLICY IF EXISTS "Authenticated users can delete daily_incomes" ON public.daily_incomes;

CREATE POLICY "Org members can read daily_incomes" ON public.daily_incomes FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) OR organization_id IS NULL);
CREATE POLICY "Org members can insert daily_incomes" ON public.daily_incomes FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_org_id(auth.uid()));
CREATE POLICY "Org members can update daily_incomes" ON public.daily_incomes FOR UPDATE TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) OR organization_id IS NULL);
CREATE POLICY "Org members can delete daily_incomes" ON public.daily_incomes FOR DELETE TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) OR organization_id IS NULL);

-- CATEGORIES
DROP POLICY IF EXISTS "Authenticated users can read categories" ON public.categories;
DROP POLICY IF EXISTS "Authenticated users can insert categories" ON public.categories;
DROP POLICY IF EXISTS "Authenticated users can update categories" ON public.categories;
DROP POLICY IF EXISTS "Authenticated users can delete categories" ON public.categories;

CREATE POLICY "Org members can read categories" ON public.categories FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) OR organization_id IS NULL);
CREATE POLICY "Org members can insert categories" ON public.categories FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_org_id(auth.uid()));
CREATE POLICY "Org members can update categories" ON public.categories FOR UPDATE TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) OR organization_id IS NULL);
CREATE POLICY "Org members can delete categories" ON public.categories FOR DELETE TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) OR organization_id IS NULL);

-- SUBCATEGORIES
DROP POLICY IF EXISTS "Authenticated users can read subcategories" ON public.subcategories;
DROP POLICY IF EXISTS "Authenticated users can insert subcategories" ON public.subcategories;
DROP POLICY IF EXISTS "Authenticated users can update subcategories" ON public.subcategories;
DROP POLICY IF EXISTS "Authenticated users can delete subcategories" ON public.subcategories;

CREATE POLICY "Org members can read subcategories" ON public.subcategories FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) OR organization_id IS NULL);
CREATE POLICY "Org members can insert subcategories" ON public.subcategories FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_org_id(auth.uid()));
CREATE POLICY "Org members can update subcategories" ON public.subcategories FOR UPDATE TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) OR organization_id IS NULL);
CREATE POLICY "Org members can delete subcategories" ON public.subcategories FOR DELETE TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) OR organization_id IS NULL);

-- FORNECEDORES
DROP POLICY IF EXISTS "Authenticated users can read fornecedores" ON public.fornecedores;
DROP POLICY IF EXISTS "Authenticated users can insert fornecedores" ON public.fornecedores;
DROP POLICY IF EXISTS "Authenticated users can update fornecedores" ON public.fornecedores;
DROP POLICY IF EXISTS "Authenticated users can delete fornecedores" ON public.fornecedores;

CREATE POLICY "Org members can read fornecedores" ON public.fornecedores FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) OR organization_id IS NULL);
CREATE POLICY "Org members can insert fornecedores" ON public.fornecedores FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_org_id(auth.uid()));
CREATE POLICY "Org members can update fornecedores" ON public.fornecedores FOR UPDATE TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) OR organization_id IS NULL);
CREATE POLICY "Org members can delete fornecedores" ON public.fornecedores FOR DELETE TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) OR organization_id IS NULL);

-- PRODUCTS
DROP POLICY IF EXISTS "Authenticated users can read products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can insert products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can update products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can delete products" ON public.products;

CREATE POLICY "Org members can read products" ON public.products FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) OR organization_id IS NULL);
CREATE POLICY "Org members can insert products" ON public.products FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_org_id(auth.uid()));
CREATE POLICY "Org members can update products" ON public.products FOR UPDATE TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) OR organization_id IS NULL);
CREATE POLICY "Org members can delete products" ON public.products FOR DELETE TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) OR organization_id IS NULL);

-- NOTES
DROP POLICY IF EXISTS "Authenticated users can read notes" ON public.notes;
DROP POLICY IF EXISTS "Authenticated users can insert notes" ON public.notes;
DROP POLICY IF EXISTS "Authenticated users can update notes" ON public.notes;
DROP POLICY IF EXISTS "Authenticated users can delete notes" ON public.notes;

CREATE POLICY "Org members can read notes" ON public.notes FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) OR organization_id IS NULL);
CREATE POLICY "Org members can insert notes" ON public.notes FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_org_id(auth.uid()));
CREATE POLICY "Org members can update notes" ON public.notes FOR UPDATE TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) OR organization_id IS NULL);
CREATE POLICY "Org members can delete notes" ON public.notes FOR DELETE TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) OR organization_id IS NULL);

-- BILLING_CLIENTS
DROP POLICY IF EXISTS "Authenticated users can read billing_clients" ON public.billing_clients;
DROP POLICY IF EXISTS "Authenticated users can insert billing_clients" ON public.billing_clients;
DROP POLICY IF EXISTS "Authenticated users can update billing_clients" ON public.billing_clients;
DROP POLICY IF EXISTS "Authenticated users can delete billing_clients" ON public.billing_clients;

CREATE POLICY "Org members can read billing_clients" ON public.billing_clients FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) OR organization_id IS NULL);
CREATE POLICY "Org members can insert billing_clients" ON public.billing_clients FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_org_id(auth.uid()));
CREATE POLICY "Org members can update billing_clients" ON public.billing_clients FOR UPDATE TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) OR organization_id IS NULL);
CREATE POLICY "Org members can delete billing_clients" ON public.billing_clients FOR DELETE TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) OR organization_id IS NULL);

-- BILLING_CHARGES
DROP POLICY IF EXISTS "Authenticated users can read billing_charges" ON public.billing_charges;
DROP POLICY IF EXISTS "Authenticated users can insert billing_charges" ON public.billing_charges;
DROP POLICY IF EXISTS "Authenticated users can update billing_charges" ON public.billing_charges;
DROP POLICY IF EXISTS "Authenticated users can delete billing_charges" ON public.billing_charges;

CREATE POLICY "Org members can read billing_charges" ON public.billing_charges FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) OR organization_id IS NULL);
CREATE POLICY "Org members can insert billing_charges" ON public.billing_charges FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_org_id(auth.uid()));
CREATE POLICY "Org members can update billing_charges" ON public.billing_charges FOR UPDATE TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) OR organization_id IS NULL);
CREATE POLICY "Org members can delete billing_charges" ON public.billing_charges FOR DELETE TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) OR organization_id IS NULL);

-- PUSH_SUBSCRIPTIONS
DROP POLICY IF EXISTS "Authenticated users can read push_subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Authenticated users can insert push_subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Authenticated users can update push_subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Authenticated users can delete push_subscriptions" ON public.push_subscriptions;

CREATE POLICY "Org members can read push_subscriptions" ON public.push_subscriptions FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) OR organization_id IS NULL);
CREATE POLICY "Org members can insert push_subscriptions" ON public.push_subscriptions FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_org_id(auth.uid()));
CREATE POLICY "Org members can update push_subscriptions" ON public.push_subscriptions FOR UPDATE TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) OR organization_id IS NULL);
CREATE POLICY "Org members can delete push_subscriptions" ON public.push_subscriptions FOR DELETE TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) OR organization_id IS NULL);

-- TAB_VISIBILITY (keep user-level + add org scope)
DROP POLICY IF EXISTS "Users can view their own tab visibility" ON public.tab_visibility;
DROP POLICY IF EXISTS "Users can update their own tab visibility" ON public.tab_visibility;
DROP POLICY IF EXISTS "Admins can view all tab visibility" ON public.tab_visibility;
DROP POLICY IF EXISTS "Admins can update all tab visibility" ON public.tab_visibility;
DROP POLICY IF EXISTS "Admins can insert tab visibility" ON public.tab_visibility;
DROP POLICY IF EXISTS "Admins can delete tab visibility" ON public.tab_visibility;

CREATE POLICY "Org members can read tab_visibility" ON public.tab_visibility FOR SELECT TO authenticated
  USING ((organization_id = get_user_org_id(auth.uid()) OR organization_id IS NULL) AND (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Org members can insert tab_visibility" ON public.tab_visibility FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_org_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Org members can update tab_visibility" ON public.tab_visibility FOR UPDATE TO authenticated
  USING ((organization_id = get_user_org_id(auth.uid()) OR organization_id IS NULL) AND (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Org members can delete tab_visibility" ON public.tab_visibility FOR DELETE TO authenticated
  USING ((organization_id = get_user_org_id(auth.uid()) OR organization_id IS NULL) AND has_role(auth.uid(), 'admin'::app_role));

-- AUDIT_LOG (keep existing admin read + add org scope)
DROP POLICY IF EXISTS "Admins can read audit_log" ON public.audit_log;
DROP POLICY IF EXISTS "Authenticated can insert audit_log" ON public.audit_log;

CREATE POLICY "Org admins can read audit_log" ON public.audit_log FOR SELECT TO authenticated
  USING ((organization_id = get_user_org_id(auth.uid()) OR organization_id IS NULL) AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Org members can insert audit_log" ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_org_id(auth.uid()) OR organization_id IS NULL);

-- 10. Add organization_id to profiles table for quick lookup
ALTER TABLE public.profiles ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
CREATE INDEX idx_profiles_org ON public.profiles(organization_id);

-- Enable realtime for organizations and organization_members
ALTER PUBLICATION supabase_realtime ADD TABLE public.organizations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.organization_members;
