
-- Fix unique constraint to be per-organization
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_code_key;
ALTER TABLE public.categories ADD CONSTRAINT categories_org_code_key UNIQUE (organization_id, code);

-- Repair corrupted default category names on org 46318ca7
UPDATE public.categories SET name = 'Bebidas'      WHERE code = 'B'  AND name = 'Categoria B';
UPDATE public.categories SET name = 'Comida'       WHERE code = 'C'  AND name = 'Categoria C';
UPDATE public.categories SET name = 'Lounge Beach' WHERE code = 'LB' AND name = 'Categoria LB';

-- Seed default categories for any organization that has none
INSERT INTO public.categories (organization_id, code, name, color)
SELECT o.id, d.code, d.name, d.color
FROM public.organizations o
CROSS JOIN (VALUES
  ('C',  'Comida',            'hsl(25, 95%, 53%)'),
  ('B',  'Bebidas',           'hsl(200, 80%, 50%)'),
  ('FX', 'Fixo',              'hsl(260, 60%, 55%)'),
  ('MO', 'Mão de Obra',       'hsl(152, 60%, 48%)'),
  ('E',  'Equipamentos',      'hsl(38, 92%, 50%)'),
  ('FR', 'Mão de Obra Extra', 'hsl(330, 70%, 55%)'),
  ('LB', 'Lounge Beach',      'hsl(180, 60%, 45%)'),
  ('O',  'Outros',            'hsl(215, 12%, 50%)'),
  ('R',  'Reforma',           'hsl(15, 80%, 45%)'),
  ('RT', 'Retirada',          'hsl(0, 0%, 60%)')
) AS d(code, name, color)
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories c WHERE c.organization_id = o.id AND c.code = d.code
);
