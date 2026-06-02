
-- Funcionários
CREATE TABLE public.payroll_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  nome text NOT NULL,
  salario numeric NOT NULL DEFAULT 0,
  quinzena numeric NOT NULL DEFAULT 0,
  extra_padrao numeric NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_employees TO authenticated;
GRANT ALL ON public.payroll_employees TO service_role;

ALTER TABLE public.payroll_employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read payroll_employees" ON public.payroll_employees
  FOR SELECT TO authenticated USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members insert payroll_employees" ON public.payroll_employees
  FOR INSERT TO authenticated WITH CHECK (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members update payroll_employees" ON public.payroll_employees
  FOR UPDATE TO authenticated USING (is_org_member(auth.uid(), organization_id)) WITH CHECK (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members delete payroll_employees" ON public.payroll_employees
  FOR DELETE TO authenticated USING (is_org_member(auth.uid(), organization_id));

-- Folha lançada por mês
CREATE TABLE public.payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  ano integer NOT NULL,
  mes integer NOT NULL,
  total numeric NOT NULL DEFAULT 0,
  lancado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, ano, mes)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_runs TO authenticated;
GRANT ALL ON public.payroll_runs TO service_role;

ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read payroll_runs" ON public.payroll_runs
  FOR SELECT TO authenticated USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members insert payroll_runs" ON public.payroll_runs
  FOR INSERT TO authenticated WITH CHECK (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members update payroll_runs" ON public.payroll_runs
  FOR UPDATE TO authenticated USING (is_org_member(auth.uid(), organization_id)) WITH CHECK (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members delete payroll_runs" ON public.payroll_runs
  FOR DELETE TO authenticated USING (is_org_member(auth.uid(), organization_id));

-- Itens da folha
CREATE TABLE public.payroll_run_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  employee_id uuid,
  nome_snapshot text NOT NULL,
  salario numeric NOT NULL DEFAULT 0,
  quinzena numeric NOT NULL DEFAULT 0,
  extra numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  transaction_id bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_run_items TO authenticated;
GRANT ALL ON public.payroll_run_items TO service_role;

ALTER TABLE public.payroll_run_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read payroll_run_items" ON public.payroll_run_items
  FOR SELECT TO authenticated USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members insert payroll_run_items" ON public.payroll_run_items
  FOR INSERT TO authenticated WITH CHECK (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members update payroll_run_items" ON public.payroll_run_items
  FOR UPDATE TO authenticated USING (is_org_member(auth.uid(), organization_id)) WITH CHECK (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members delete payroll_run_items" ON public.payroll_run_items
  FOR DELETE TO authenticated USING (is_org_member(auth.uid(), organization_id));

CREATE INDEX idx_payroll_employees_org ON public.payroll_employees(organization_id);
CREATE INDEX idx_payroll_runs_org ON public.payroll_runs(organization_id, ano, mes);
CREATE INDEX idx_payroll_run_items_run ON public.payroll_run_items(run_id);
