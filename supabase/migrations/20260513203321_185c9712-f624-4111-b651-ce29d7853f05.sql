
-- daily_incomes
DROP POLICY IF EXISTS "Org members can delete daily_incomes" ON public.daily_incomes;
DROP POLICY IF EXISTS "Org members can insert daily_incomes" ON public.daily_incomes;
DROP POLICY IF EXISTS "Org members can read daily_incomes" ON public.daily_incomes;
DROP POLICY IF EXISTS "Org members can update daily_incomes" ON public.daily_incomes;

CREATE POLICY "Org members can read daily_incomes" ON public.daily_incomes FOR SELECT TO authenticated
  USING (organization_id IS NULL OR is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can insert daily_incomes" ON public.daily_incomes FOR INSERT TO authenticated
  WITH CHECK (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can update daily_incomes" ON public.daily_incomes FOR UPDATE TO authenticated
  USING (organization_id IS NULL OR is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can delete daily_incomes" ON public.daily_incomes FOR DELETE TO authenticated
  USING (organization_id IS NULL OR is_org_member(auth.uid(), organization_id));

-- transactions
DROP POLICY IF EXISTS "Org members can delete transactions" ON public.transactions;
DROP POLICY IF EXISTS "Org members can insert transactions" ON public.transactions;
DROP POLICY IF EXISTS "Org members can read transactions" ON public.transactions;
DROP POLICY IF EXISTS "Org members can update transactions" ON public.transactions;

CREATE POLICY "Org members can read transactions" ON public.transactions FOR SELECT TO authenticated
  USING (organization_id IS NULL OR is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can insert transactions" ON public.transactions FOR INSERT TO authenticated
  WITH CHECK (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can update transactions" ON public.transactions FOR UPDATE TO authenticated
  USING (organization_id IS NULL OR is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can delete transactions" ON public.transactions FOR DELETE TO authenticated
  USING (organization_id IS NULL OR is_org_member(auth.uid(), organization_id));

-- fornecedores
DROP POLICY IF EXISTS "Org members can delete fornecedores" ON public.fornecedores;
DROP POLICY IF EXISTS "Org members can insert fornecedores" ON public.fornecedores;
DROP POLICY IF EXISTS "Org members can read fornecedores" ON public.fornecedores;
DROP POLICY IF EXISTS "Org members can update fornecedores" ON public.fornecedores;

CREATE POLICY "Org members can read fornecedores" ON public.fornecedores FOR SELECT TO authenticated
  USING (organization_id IS NULL OR is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can insert fornecedores" ON public.fornecedores FOR INSERT TO authenticated
  WITH CHECK (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can update fornecedores" ON public.fornecedores FOR UPDATE TO authenticated
  USING (organization_id IS NULL OR is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can delete fornecedores" ON public.fornecedores FOR DELETE TO authenticated
  USING (organization_id IS NULL OR is_org_member(auth.uid(), organization_id));

-- products
DROP POLICY IF EXISTS "Org members can delete products" ON public.products;
DROP POLICY IF EXISTS "Org members can insert products" ON public.products;
DROP POLICY IF EXISTS "Org members can read products" ON public.products;
DROP POLICY IF EXISTS "Org members can update products" ON public.products;

CREATE POLICY "Org members can read products" ON public.products FOR SELECT TO authenticated
  USING (organization_id IS NULL OR is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can insert products" ON public.products FOR INSERT TO authenticated
  WITH CHECK (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can update products" ON public.products FOR UPDATE TO authenticated
  USING (organization_id IS NULL OR is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can delete products" ON public.products FOR DELETE TO authenticated
  USING (organization_id IS NULL OR is_org_member(auth.uid(), organization_id));

-- push_subscriptions
DROP POLICY IF EXISTS "Org members can delete push_subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Org members can insert push_subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Org members can read push_subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Org members can update push_subscriptions" ON public.push_subscriptions;

CREATE POLICY "Org members can read push_subscriptions" ON public.push_subscriptions FOR SELECT TO authenticated
  USING (organization_id IS NULL OR is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can insert push_subscriptions" ON public.push_subscriptions FOR INSERT TO authenticated
  WITH CHECK (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can update push_subscriptions" ON public.push_subscriptions FOR UPDATE TO authenticated
  USING (organization_id IS NULL OR is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can delete push_subscriptions" ON public.push_subscriptions FOR DELETE TO authenticated
  USING (organization_id IS NULL OR is_org_member(auth.uid(), organization_id));

-- notes
DROP POLICY IF EXISTS "Org members can delete notes" ON public.notes;
DROP POLICY IF EXISTS "Org members can insert notes" ON public.notes;
DROP POLICY IF EXISTS "Org members can read notes" ON public.notes;
DROP POLICY IF EXISTS "Org members can update notes" ON public.notes;

CREATE POLICY "Org members can read notes" ON public.notes FOR SELECT TO authenticated
  USING (organization_id IS NULL OR is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can insert notes" ON public.notes FOR INSERT TO authenticated
  WITH CHECK (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can update notes" ON public.notes FOR UPDATE TO authenticated
  USING (organization_id IS NULL OR is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can delete notes" ON public.notes FOR DELETE TO authenticated
  USING (organization_id IS NULL OR is_org_member(auth.uid(), organization_id));

-- subcategories
DROP POLICY IF EXISTS "Org members can delete subcategories" ON public.subcategories;
DROP POLICY IF EXISTS "Org members can insert subcategories" ON public.subcategories;
DROP POLICY IF EXISTS "Org members can read subcategories" ON public.subcategories;
DROP POLICY IF EXISTS "Org members can update subcategories" ON public.subcategories;

CREATE POLICY "Org members can read subcategories" ON public.subcategories FOR SELECT TO authenticated
  USING (organization_id IS NULL OR is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can insert subcategories" ON public.subcategories FOR INSERT TO authenticated
  WITH CHECK (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can update subcategories" ON public.subcategories FOR UPDATE TO authenticated
  USING (organization_id IS NULL OR is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can delete subcategories" ON public.subcategories FOR DELETE TO authenticated
  USING (organization_id IS NULL OR is_org_member(auth.uid(), organization_id));
