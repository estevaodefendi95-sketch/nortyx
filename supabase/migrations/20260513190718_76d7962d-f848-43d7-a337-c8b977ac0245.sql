DROP POLICY IF EXISTS "Org members can read categories" ON public.categories;
DROP POLICY IF EXISTS "Org members can insert categories" ON public.categories;
DROP POLICY IF EXISTS "Org members can update categories" ON public.categories;
DROP POLICY IF EXISTS "Org members can delete categories" ON public.categories;
DROP POLICY IF EXISTS "Super user can read all categories" ON public.categories;
DROP POLICY IF EXISTS "Super user can insert categories" ON public.categories;
DROP POLICY IF EXISTS "Super user can update all categories" ON public.categories;
DROP POLICY IF EXISTS "Super user can delete all categories" ON public.categories;

CREATE POLICY "Org members can read categories"
ON public.categories
FOR SELECT
TO authenticated
USING (
  organization_id IS NULL
  OR public.is_org_member(auth.uid(), organization_id)
  OR public.is_super_user(auth.uid())
);

CREATE POLICY "Org members can insert categories"
ON public.categories
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_org_member(auth.uid(), organization_id)
  OR public.is_super_user(auth.uid())
);

CREATE POLICY "Org members can update categories"
ON public.categories
FOR UPDATE
TO authenticated
USING (
  public.is_org_member(auth.uid(), organization_id)
  OR public.is_super_user(auth.uid())
)
WITH CHECK (
  public.is_org_member(auth.uid(), organization_id)
  OR public.is_super_user(auth.uid())
);

CREATE POLICY "Org members can delete categories"
ON public.categories
FOR DELETE
TO authenticated
USING (
  public.is_org_member(auth.uid(), organization_id)
  OR public.is_super_user(auth.uid())
);