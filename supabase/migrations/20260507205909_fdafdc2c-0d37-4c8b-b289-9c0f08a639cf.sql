-- Allow super user to manage memberships across all organizations
CREATE POLICY "Super user manage members"
  ON public.organization_members FOR ALL
  TO authenticated
  USING (public.is_super_user(auth.uid()))
  WITH CHECK (public.is_super_user(auth.uid()));

-- Allow super user to update any profile (including organization_id)
CREATE POLICY "Super user can update any profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_super_user(auth.uid()))
  WITH CHECK (public.is_super_user(auth.uid()));