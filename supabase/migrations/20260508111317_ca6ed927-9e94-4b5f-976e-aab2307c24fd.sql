
ALTER TABLE public.billing_charges
  ADD COLUMN IF NOT EXISTS boleto_url text,
  ADD COLUMN IF NOT EXISTS nf_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('billing-attachments', 'billing-attachments', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Org members read billing attachments" ON storage.objects;
DROP POLICY IF EXISTS "Org members upload billing attachments" ON storage.objects;
DROP POLICY IF EXISTS "Org members update billing attachments" ON storage.objects;
DROP POLICY IF EXISTS "Org members delete billing attachments" ON storage.objects;
DROP POLICY IF EXISTS "Super user manage billing attachments" ON storage.objects;

CREATE POLICY "Org members read billing attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'billing-attachments'
  AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Org members upload billing attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'billing-attachments'
  AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Org members update billing attachments"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'billing-attachments'
  AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Org members delete billing attachments"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'billing-attachments'
  AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Super user manage billing attachments"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'billing-attachments' AND public.is_super_user(auth.uid()))
WITH CHECK (bucket_id = 'billing-attachments' AND public.is_super_user(auth.uid()));
