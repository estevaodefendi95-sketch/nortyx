
-- Allow system admins to manage orgs they belong to
CREATE POLICY "System admins can update member orgs"
ON public.organizations FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin') AND is_org_member(auth.uid(), id))
WITH CHECK (has_role(auth.uid(), 'admin') AND is_org_member(auth.uid(), id));

-- org_dashboard_settings
CREATE POLICY "System admins insert dashboard settings any org"
ON public.org_dashboard_settings FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin') AND is_org_member(auth.uid(), organization_id));

CREATE POLICY "System admins update dashboard settings any org"
ON public.org_dashboard_settings FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin') AND is_org_member(auth.uid(), organization_id))
WITH CHECK (has_role(auth.uid(), 'admin') AND is_org_member(auth.uid(), organization_id));

CREATE POLICY "System admins read dashboard settings any org"
ON public.org_dashboard_settings FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') AND is_org_member(auth.uid(), organization_id));

-- organization_members
CREATE POLICY "System admins insert members any org"
ON public.organization_members FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin') AND is_org_member(auth.uid(), organization_id));

CREATE POLICY "System admins update members any org"
ON public.organization_members FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin') AND is_org_member(auth.uid(), organization_id))
WITH CHECK (has_role(auth.uid(), 'admin') AND is_org_member(auth.uid(), organization_id));

CREATE POLICY "System admins delete members any org"
ON public.organization_members FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin') AND is_org_member(auth.uid(), organization_id));

-- organization_invites
CREATE POLICY "System admins manage invites any org"
ON public.organization_invites FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin') AND is_org_member(auth.uid(), organization_id))
WITH CHECK (has_role(auth.uid(), 'admin') AND is_org_member(auth.uid(), organization_id));

-- tab_visibility
CREATE POLICY "System admins manage tab_visibility any org"
ON public.tab_visibility FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin') AND (organization_id IS NULL OR is_org_member(auth.uid(), organization_id)))
WITH CHECK (has_role(auth.uid(), 'admin') AND (organization_id IS NULL OR is_org_member(auth.uid(), organization_id)));
