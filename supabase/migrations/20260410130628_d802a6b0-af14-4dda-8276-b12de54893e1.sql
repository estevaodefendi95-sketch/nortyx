
-- Tabela de clientes para cobrança
CREATE TABLE public.billing_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  email text NOT NULL,
  telefone text,
  forma_cobranca text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read billing_clients"
  ON public.billing_clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert billing_clients"
  ON public.billing_clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update billing_clients"
  ON public.billing_clients FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete billing_clients"
  ON public.billing_clients FOR DELETE TO authenticated USING (true);

-- Tabela de cobranças
CREATE TABLE public.billing_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.billing_clients(id) ON DELETE CASCADE NOT NULL,
  transaction_id bigint,
  valor numeric NOT NULL,
  data_cobranca text NOT NULL,
  recorrente boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pendente',
  email_enviado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read billing_charges"
  ON public.billing_charges FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert billing_charges"
  ON public.billing_charges FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update billing_charges"
  ON public.billing_charges FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete billing_charges"
  ON public.billing_charges FOR DELETE TO authenticated USING (true);

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.billing_charges;
