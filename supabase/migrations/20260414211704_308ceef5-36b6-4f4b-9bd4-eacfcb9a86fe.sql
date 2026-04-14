
CREATE TABLE public.org_dashboard_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  show_faturamento_medio boolean NOT NULL DEFAULT true,
  show_cmv boolean NOT NULL DEFAULT true,
  show_top_foods boolean NOT NULL DEFAULT true,
  show_top_drinks boolean NOT NULL DEFAULT true,
  cmv_categories text[] NOT NULL DEFAULT '{C,B}',
  top_foods_title text NOT NULL DEFAULT 'Top 10 Comidas',
  top_drinks_title text NOT NULL DEFAULT 'Top 10 Bebidas',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

ALTER TABLE public.org_dashboard_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read dashboard settings"
  ON public.org_dashboard_settings FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Org admins can insert dashboard settings"
  ON public.org_dashboard_settings FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Org admins can update dashboard settings"
  ON public.org_dashboard_settings FOR UPDATE TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_org_dashboard_settings_updated_at
  BEFORE UPDATE ON public.org_dashboard_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
