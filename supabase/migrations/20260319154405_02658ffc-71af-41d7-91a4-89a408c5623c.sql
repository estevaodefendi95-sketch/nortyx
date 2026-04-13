
-- Create subcategories table
CREATE TABLE public.subcategories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_code text NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT 'hsl(215, 12%, 50%)',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can read subcategories" ON public.subcategories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert subcategories" ON public.subcategories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update subcategories" ON public.subcategories FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete subcategories" ON public.subcategories FOR DELETE TO authenticated USING (true);

-- Add subcategory column to transactions
ALTER TABLE public.transactions ADD COLUMN subcategoria text DEFAULT NULL;

-- Enable realtime for subcategories
ALTER PUBLICATION supabase_realtime ADD TABLE public.subcategories;
