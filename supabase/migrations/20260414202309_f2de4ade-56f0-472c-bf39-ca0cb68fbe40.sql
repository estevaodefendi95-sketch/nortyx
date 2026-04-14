-- Create storage bucket for organization logos
INSERT INTO storage.buckets (id, name, public) VALUES ('org-logos', 'org-logos', true);

-- Anyone can view logos (public bucket)
CREATE POLICY "Org logos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'org-logos');

-- Org owners/admins can upload logos
CREATE POLICY "Org members can upload logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'org-logos'
  AND auth.role() = 'authenticated'
);

-- Org owners/admins can update logos
CREATE POLICY "Org members can update logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'org-logos'
  AND auth.role() = 'authenticated'
);

-- Org owners/admins can delete logos
CREATE POLICY "Org members can delete logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'org-logos'
  AND auth.role() = 'authenticated'
);