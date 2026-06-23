
-- Fix audit_log_insert_org_scope: remove client INSERT policy; writes happen server-side via service role
DROP POLICY IF EXISTS "Org members can insert audit_log" ON public.audit_log;

-- Fix organization_members_self_insert: remove duplicate permissive INSERT policy on public role
DROP POLICY IF EXISTS "Owners can manage members" ON public.organization_members;
DROP POLICY IF EXISTS "Owners can update members" ON public.organization_members;
DROP POLICY IF EXISTS "Owners can delete members" ON public.organization_members;

-- Fix profiles_org_member_cross_read: scope admin reads/updates to admin's own org via membership
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;

CREATE POLICY "Admins can view profiles in their org"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = profiles.user_id
      AND is_org_member(auth.uid(), om.organization_id)
  )
);

CREATE POLICY "Admins can update profiles in their org"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = profiles.user_id
      AND is_org_member(auth.uid(), om.organization_id)
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = profiles.user_id
      AND is_org_member(auth.uid(), om.organization_id)
  )
);
