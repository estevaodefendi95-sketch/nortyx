
-- profiles: super user pode ver todos
CREATE POLICY "Super user can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.is_super_user(auth.uid()));

-- user_roles: super user gerencia tudo
CREATE POLICY "Super user can view all roles"
ON public.user_roles FOR SELECT TO authenticated
USING (public.is_super_user(auth.uid()));

CREATE POLICY "Super user can insert roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.is_super_user(auth.uid()));

CREATE POLICY "Super user can update roles"
ON public.user_roles FOR UPDATE TO authenticated
USING (public.is_super_user(auth.uid()))
WITH CHECK (public.is_super_user(auth.uid()));

CREATE POLICY "Super user can delete roles"
ON public.user_roles FOR DELETE TO authenticated
USING (public.is_super_user(auth.uid()));

-- tab_visibility: super user gerencia tudo
CREATE POLICY "Super user can insert tab_visibility"
ON public.tab_visibility FOR INSERT TO authenticated
WITH CHECK (public.is_super_user(auth.uid()));

CREATE POLICY "Super user can update tab_visibility"
ON public.tab_visibility FOR UPDATE TO authenticated
USING (public.is_super_user(auth.uid()))
WITH CHECK (public.is_super_user(auth.uid()));

CREATE POLICY "Super user can delete tab_visibility"
ON public.tab_visibility FOR DELETE TO authenticated
USING (public.is_super_user(auth.uid()));
