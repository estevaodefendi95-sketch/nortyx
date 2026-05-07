CREATE POLICY "Super user can insert dashboard settings"
ON public.org_dashboard_settings FOR INSERT TO authenticated
WITH CHECK (is_super_user(auth.uid()));

CREATE POLICY "Super user can update dashboard settings"
ON public.org_dashboard_settings FOR UPDATE TO authenticated
USING (is_super_user(auth.uid()))
WITH CHECK (is_super_user(auth.uid()));

CREATE POLICY "Org owners can insert dashboard settings"
ON public.org_dashboard_settings FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid()
      AND organization_id = org_dashboard_settings.organization_id
      AND role = 'owner'::org_role
  )
);

CREATE POLICY "Org owners can update dashboard settings"
ON public.org_dashboard_settings FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid()
      AND organization_id = org_dashboard_settings.organization_id
      AND role = 'owner'::org_role
  )
);