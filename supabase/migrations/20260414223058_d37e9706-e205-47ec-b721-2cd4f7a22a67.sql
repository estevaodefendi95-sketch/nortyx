
-- Function to check if user is super user
CREATE OR REPLACE FUNCTION public.is_super_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _user_id AND email = 'estevaodefendi95@gmail.com'
  )
$$;

-- Super user SELECT policies for all relevant tables
CREATE POLICY "Super user can view all organizations"
ON public.organizations FOR SELECT TO authenticated
USING (public.is_super_user(auth.uid()));

CREATE POLICY "Super user can read all transactions"
ON public.transactions FOR SELECT TO authenticated
USING (public.is_super_user(auth.uid()));

CREATE POLICY "Super user can read all daily_incomes"
ON public.daily_incomes FOR SELECT TO authenticated
USING (public.is_super_user(auth.uid()));

CREATE POLICY "Super user can read all products"
ON public.products FOR SELECT TO authenticated
USING (public.is_super_user(auth.uid()));

CREATE POLICY "Super user can read all org_dashboard_settings"
ON public.org_dashboard_settings FOR SELECT TO authenticated
USING (public.is_super_user(auth.uid()));

CREATE POLICY "Super user can read all categories"
ON public.categories FOR SELECT TO authenticated
USING (public.is_super_user(auth.uid()));

CREATE POLICY "Super user can read all subcategories"
ON public.subcategories FOR SELECT TO authenticated
USING (public.is_super_user(auth.uid()));

CREATE POLICY "Super user can read all fornecedores"
ON public.fornecedores FOR SELECT TO authenticated
USING (public.is_super_user(auth.uid()));

CREATE POLICY "Super user can read all billing_clients"
ON public.billing_clients FOR SELECT TO authenticated
USING (public.is_super_user(auth.uid()));

CREATE POLICY "Super user can read all billing_charges"
ON public.billing_charges FOR SELECT TO authenticated
USING (public.is_super_user(auth.uid()));

CREATE POLICY "Super user can read all notes"
ON public.notes FOR SELECT TO authenticated
USING (public.is_super_user(auth.uid()));

CREATE POLICY "Super user can read all tab_visibility"
ON public.tab_visibility FOR SELECT TO authenticated
USING (public.is_super_user(auth.uid()));

CREATE POLICY "Super user can read all audit_log"
ON public.audit_log FOR SELECT TO authenticated
USING (public.is_super_user(auth.uid()));

CREATE POLICY "Super user can read all push_subscriptions"
ON public.push_subscriptions FOR SELECT TO authenticated
USING (public.is_super_user(auth.uid()));
