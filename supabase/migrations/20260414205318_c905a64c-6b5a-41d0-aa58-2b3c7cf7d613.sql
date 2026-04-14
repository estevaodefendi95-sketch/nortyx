
-- Drop all existing policies on organization_members
DROP POLICY IF EXISTS "Members can view org members" ON public.organization_members;
DROP POLICY IF EXISTS "Owners can manage members" ON public.organization_members;
DROP POLICY IF EXISTS "Users can insert themselves" ON public.organization_members;
DROP POLICY IF EXISTS "Owners can update members" ON public.organization_members;
DROP POLICY IF EXISTS "Owners can delete members" ON public.organization_members;

-- SELECT: user can see own row OR rows in their org
CREATE POLICY "Members can view org members"
ON public.organization_members FOR SELECT TO authenticated
USING (user_id = auth.uid() OR organization_id = get_user_org_id(auth.uid()));

-- INSERT (self): user can add themselves to any org (onboarding)
CREATE POLICY "Users can insert themselves"
ON public.organization_members FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- INSERT (admin): org admins/owners can add other members
CREATE POLICY "Owners can manage members"
ON public.organization_members FOR INSERT TO authenticated
WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

-- UPDATE: org admins/owners can update members
CREATE POLICY "Owners can update members"
ON public.organization_members FOR UPDATE TO authenticated
USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

-- DELETE: org admins/owners can remove members
CREATE POLICY "Owners can delete members"
ON public.organization_members FOR DELETE TO authenticated
USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));
