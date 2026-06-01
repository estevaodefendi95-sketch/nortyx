
-- ============ 1. Close organization_id IS NULL bypass on per-org tables ============
-- transactions
DROP POLICY IF EXISTS "Org members can read transactions" ON public.transactions;
CREATE POLICY "Org members can read transactions" ON public.transactions FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Org members can update transactions" ON public.transactions;
CREATE POLICY "Org members can update transactions" ON public.transactions FOR UPDATE TO authenticated
  USING (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id))
  WITH CHECK (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Org members can delete transactions" ON public.transactions;
CREATE POLICY "Org members can delete transactions" ON public.transactions FOR DELETE TO authenticated
  USING (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id));

-- products
DROP POLICY IF EXISTS "Org members can read products" ON public.products;
CREATE POLICY "Org members can read products" ON public.products FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Org members can update products" ON public.products;
CREATE POLICY "Org members can update products" ON public.products FOR UPDATE TO authenticated
  USING (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id))
  WITH CHECK (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Org members can delete products" ON public.products;
CREATE POLICY "Org members can delete products" ON public.products FOR DELETE TO authenticated
  USING (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id));

-- daily_incomes
DROP POLICY IF EXISTS "Org members can read daily_incomes" ON public.daily_incomes;
CREATE POLICY "Org members can read daily_incomes" ON public.daily_incomes FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Org members can update daily_incomes" ON public.daily_incomes;
CREATE POLICY "Org members can update daily_incomes" ON public.daily_incomes FOR UPDATE TO authenticated
  USING (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id))
  WITH CHECK (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Org members can delete daily_incomes" ON public.daily_incomes;
CREATE POLICY "Org members can delete daily_incomes" ON public.daily_incomes FOR DELETE TO authenticated
  USING (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id));

-- notes
DROP POLICY IF EXISTS "Org members can read notes" ON public.notes;
CREATE POLICY "Org members can read notes" ON public.notes FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Org members can update notes" ON public.notes;
CREATE POLICY "Org members can update notes" ON public.notes FOR UPDATE TO authenticated
  USING (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id))
  WITH CHECK (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Org members can delete notes" ON public.notes;
CREATE POLICY "Org members can delete notes" ON public.notes FOR DELETE TO authenticated
  USING (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id));

-- fornecedores
DROP POLICY IF EXISTS "Org members can read fornecedores" ON public.fornecedores;
CREATE POLICY "Org members can read fornecedores" ON public.fornecedores FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Org members can update fornecedores" ON public.fornecedores;
CREATE POLICY "Org members can update fornecedores" ON public.fornecedores FOR UPDATE TO authenticated
  USING (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id))
  WITH CHECK (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Org members can delete fornecedores" ON public.fornecedores;
CREATE POLICY "Org members can delete fornecedores" ON public.fornecedores FOR DELETE TO authenticated
  USING (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id));

-- subcategories
DROP POLICY IF EXISTS "Org members can read subcategories" ON public.subcategories;
CREATE POLICY "Org members can read subcategories" ON public.subcategories FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Org members can update subcategories" ON public.subcategories;
CREATE POLICY "Org members can update subcategories" ON public.subcategories FOR UPDATE TO authenticated
  USING (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id))
  WITH CHECK (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Org members can delete subcategories" ON public.subcategories;
CREATE POLICY "Org members can delete subcategories" ON public.subcategories FOR DELETE TO authenticated
  USING (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id));

-- billing_charges
DROP POLICY IF EXISTS "Org members can read billing_charges" ON public.billing_charges;
CREATE POLICY "Org members can read billing_charges" ON public.billing_charges FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Org members can update billing_charges" ON public.billing_charges;
CREATE POLICY "Org members can update billing_charges" ON public.billing_charges FOR UPDATE TO authenticated
  USING (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id))
  WITH CHECK (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Org members can delete billing_charges" ON public.billing_charges;
CREATE POLICY "Org members can delete billing_charges" ON public.billing_charges FOR DELETE TO authenticated
  USING (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id));

-- billing_clients
DROP POLICY IF EXISTS "Org members can read billing_clients" ON public.billing_clients;
CREATE POLICY "Org members can read billing_clients" ON public.billing_clients FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Org members can update billing_clients" ON public.billing_clients;
CREATE POLICY "Org members can update billing_clients" ON public.billing_clients FOR UPDATE TO authenticated
  USING (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id))
  WITH CHECK (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Org members can delete billing_clients" ON public.billing_clients;
CREATE POLICY "Org members can delete billing_clients" ON public.billing_clients FOR DELETE TO authenticated
  USING (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id));

-- push_subscriptions
DROP POLICY IF EXISTS "Org members can read push_subscriptions" ON public.push_subscriptions;
CREATE POLICY "Org members can read push_subscriptions" ON public.push_subscriptions FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Org members can update push_subscriptions" ON public.push_subscriptions;
CREATE POLICY "Org members can update push_subscriptions" ON public.push_subscriptions FOR UPDATE TO authenticated
  USING (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id))
  WITH CHECK (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Org members can delete push_subscriptions" ON public.push_subscriptions;
CREATE POLICY "Org members can delete push_subscriptions" ON public.push_subscriptions FOR DELETE TO authenticated
  USING (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id));

-- tab_visibility
DROP POLICY IF EXISTS "Org members can read tab_visibility" ON public.tab_visibility;
CREATE POLICY "Org members can read tab_visibility" ON public.tab_visibility FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND organization_id = get_user_org_id(auth.uid()) AND ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role)));
DROP POLICY IF EXISTS "Org members can update tab_visibility" ON public.tab_visibility;
CREATE POLICY "Org members can update tab_visibility" ON public.tab_visibility FOR UPDATE TO authenticated
  USING (organization_id IS NOT NULL AND organization_id = get_user_org_id(auth.uid()) AND ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role)))
  WITH CHECK (organization_id IS NOT NULL AND organization_id = get_user_org_id(auth.uid()) AND ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role)));
DROP POLICY IF EXISTS "Org members can delete tab_visibility" ON public.tab_visibility;
CREATE POLICY "Org members can delete tab_visibility" ON public.tab_visibility FOR DELETE TO authenticated
  USING (organization_id IS NOT NULL AND organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

-- categories (also has IS NULL on read)
DROP POLICY IF EXISTS "Org members can read categories" ON public.categories;
CREATE POLICY "Org members can read categories" ON public.categories FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND (is_org_member(auth.uid(), organization_id) OR is_super_user(auth.uid())));

-- audit_log: tighten IS NULL bypass
DROP POLICY IF EXISTS "Org admins can read audit_log" ON public.audit_log;
CREATE POLICY "Org admins can read audit_log" ON public.audit_log FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Org members can insert audit_log" ON public.audit_log;
CREATE POLICY "Org members can insert audit_log" ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (organization_id IS NOT NULL AND organization_id = get_user_org_id(auth.uid()));

-- ============ 2. organization_members self-insert privilege escalation ============
DROP POLICY IF EXISTS "Users can insert themselves" ON public.organization_members;

-- ============ 3. organizations INSERT overly permissive ============
DROP POLICY IF EXISTS "Authenticated can create organizations" ON public.organizations;
CREATE POLICY "Authenticated can create organizations" ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============ 4. org-logos: restrict listing + scope writes to member org ============
DROP POLICY IF EXISTS "Org logos are publicly accessible" ON storage.objects;
-- Bucket remains public (direct URL fetch works); listing via storage.objects SELECT is no longer broad.

DROP POLICY IF EXISTS "Org members can upload logos" ON storage.objects;
CREATE POLICY "Org members can upload logos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'org-logos'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "Org members can update logos" ON storage.objects;
CREATE POLICY "Org members can update logos" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'org-logos'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "Org members can delete logos" ON storage.objects;
CREATE POLICY "Org members can delete logos" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'org-logos'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

-- ============ 5. Lock down SECURITY DEFINER helper functions ============
-- Internal/cron/trigger helpers: revoke from anon/public, keep service_role
REVOKE ALL ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_push_schedule(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_push_schedule_hour() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_billing_charge_org() FROM PUBLIC, anon, authenticated;

-- RLS helper functions: revoke from anon/public; authenticated keeps access via default? revoke from public removes all roles.
-- Re-grant to authenticated since RLS policies call these as the invoking role.
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
REVOKE ALL ON FUNCTION public.is_super_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_user(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.is_org_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.get_user_org_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_org_id(uuid) TO authenticated;

-- Client RPCs: keep only the calling role
REVOKE ALL ON FUNCTION public.accept_pending_invites(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_pending_invites(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.create_organization_with_owner(text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_organization_with_owner(text, text, uuid) TO authenticated;

-- get_login_branding is intentionally callable by anon (used on login screen).
REVOKE ALL ON FUNCTION public.get_login_branding() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_login_branding() TO anon, authenticated;

-- ============ 6. Realtime: restrict broadcast/presence subscriptions ============
-- Add a deny-all policy on realtime.messages so unauthenticated Broadcast/Presence
-- subscriptions are rejected. Postgres_changes still works (gated by table RLS).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='realtime' AND c.relname='messages') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Deny anonymous realtime channel access" ON realtime.messages';
    EXECUTE 'CREATE POLICY "Deny anonymous realtime channel access" ON realtime.messages FOR SELECT TO authenticated USING (false)';
  END IF;
END $$;
