
-- 1) Make get_user_org_id deterministic
CREATE OR REPLACE FUNCTION public.get_user_org_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT organization_id FROM public.organization_members
  WHERE user_id = _user_id
  ORDER BY created_at ASC
  LIMIT 1
$function$;

-- 2) Tighten organization_members owner policies to verify caller is admin within TARGET org
DROP POLICY IF EXISTS "Owners can manage members" ON public.organization_members;
DROP POLICY IF EXISTS "Owners can update members" ON public.organization_members;
DROP POLICY IF EXISTS "Owners can delete members" ON public.organization_members;

CREATE POLICY "Owners can manage members"
ON public.organization_members
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND is_org_member(auth.uid(), organization_id)
);

CREATE POLICY "Owners can update members"
ON public.organization_members
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND is_org_member(auth.uid(), organization_id)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND is_org_member(auth.uid(), organization_id)
);

CREATE POLICY "Owners can delete members"
ON public.organization_members
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND is_org_member(auth.uid(), organization_id)
);

-- 3) Restrict push_subscriptions reads to the owning user (super user keeps separate policy)
DROP POLICY IF EXISTS "Org members can read push_subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Org members can update push_subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Org members can delete push_subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Org members can insert push_subscriptions" ON public.push_subscriptions;

CREATE POLICY "Users read own push_subscriptions"
ON public.push_subscriptions
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users insert own push_subscriptions"
ON public.push_subscriptions
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND (organization_id IS NULL OR is_org_member(auth.uid(), organization_id))
);

CREATE POLICY "Users update own push_subscriptions"
ON public.push_subscriptions
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own push_subscriptions"
ON public.push_subscriptions
FOR DELETE
USING (user_id = auth.uid());

-- 4) Tighten tab_visibility INSERT to require org membership on admin branch
DROP POLICY IF EXISTS "Org members can insert tab_visibility" ON public.tab_visibility;

CREATE POLICY "Org members can insert tab_visibility"
ON public.tab_visibility
FOR INSERT
WITH CHECK (
  organization_id IS NOT NULL
  AND is_org_member(auth.uid(), organization_id)
  AND (
    auth.uid() = user_id
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);
