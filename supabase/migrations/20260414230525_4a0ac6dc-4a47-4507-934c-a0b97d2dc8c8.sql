CREATE OR REPLACE FUNCTION public.get_login_branding()
RETURNS TABLE(name text, logo_url text, primary_color text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.name, o.logo_url, o.primary_color
  FROM public.organizations o
  ORDER BY o.created_at ASC
  LIMIT 1;
$$;