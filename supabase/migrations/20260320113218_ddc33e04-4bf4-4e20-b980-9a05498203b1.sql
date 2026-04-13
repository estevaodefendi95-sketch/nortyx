
-- Add payment method columns to transactions
ALTER TABLE public.transactions ADD COLUMN forma_pagamento text DEFAULT NULL;
ALTER TABLE public.transactions ADD COLUMN pix_code text DEFAULT NULL;

-- Create fornecedores table to remember supplier payment preferences
CREATE TABLE public.fornecedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  nome text NOT NULL UNIQUE,
  forma_pagamento text DEFAULT NULL,
  pix_code text DEFAULT NULL
);

ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read fornecedores" ON public.fornecedores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert fornecedores" ON public.fornecedores FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update fornecedores" ON public.fornecedores FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete fornecedores" ON public.fornecedores FOR DELETE TO authenticated USING (true);
