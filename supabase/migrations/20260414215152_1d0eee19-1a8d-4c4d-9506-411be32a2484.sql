ALTER TABLE public.org_dashboard_settings
  ADD COLUMN faturamento_medio_title text NOT NULL DEFAULT 'Faturamento Médio / Dia',
  ADD COLUMN ranking_title text NOT NULL DEFAULT 'Top 10';