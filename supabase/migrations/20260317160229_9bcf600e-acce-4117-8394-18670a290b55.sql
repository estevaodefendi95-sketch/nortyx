
-- Create categories table for cross-device sync
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  color text NOT NULL DEFAULT 'hsl(215, 12%, 50%)',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read categories (shared across org)
CREATE POLICY "Authenticated users can read categories"
ON public.categories FOR SELECT TO authenticated
USING (true);

-- All authenticated users can insert categories
CREATE POLICY "Authenticated users can insert categories"
ON public.categories FOR INSERT TO authenticated
WITH CHECK (true);

-- All authenticated users can update categories
CREATE POLICY "Authenticated users can update categories"
ON public.categories FOR UPDATE TO authenticated
USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;
