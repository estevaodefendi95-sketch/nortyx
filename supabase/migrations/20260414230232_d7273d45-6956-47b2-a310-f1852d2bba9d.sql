-- Allow super user to update any organization
CREATE POLICY "Super user can update all organizations"
ON public.organizations
FOR UPDATE
TO authenticated
USING (is_super_user(auth.uid()))
WITH CHECK (is_super_user(auth.uid()));

-- Allow super user to manage org-logos storage
CREATE POLICY "Super user can upload org logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'org-logos' AND is_super_user(auth.uid()));

CREATE POLICY "Super user can update org logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'org-logos' AND is_super_user(auth.uid()));
