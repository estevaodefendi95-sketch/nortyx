
-- Transactions table
CREATE TABLE public.transactions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  empresa TEXT NOT NULL,
  valor NUMERIC NOT NULL,
  data TEXT NOT NULL, -- DD/MM/YYYY format
  categoria TEXT NOT NULL,
  pago BOOLEAN NOT NULL DEFAULT false,
  agendado BOOLEAN NOT NULL DEFAULT false,
  tipo TEXT NOT NULL DEFAULT 'saida',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Daily incomes table
CREATE TABLE public.daily_incomes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  data TEXT NOT NULL, -- DD/MM/YYYY format
  valor NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_incomes ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read
CREATE POLICY "Authenticated users can read transactions"
  ON public.transactions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert transactions"
  ON public.transactions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update transactions"
  ON public.transactions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete transactions"
  ON public.transactions FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read daily_incomes"
  ON public.daily_incomes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert daily_incomes"
  ON public.daily_incomes FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update daily_incomes"
  ON public.daily_incomes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete daily_incomes"
  ON public.daily_incomes FOR DELETE TO authenticated USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_incomes;
