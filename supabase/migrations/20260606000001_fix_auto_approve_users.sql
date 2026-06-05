-- ============================================================
-- FIX: Auto-aprovar usuários em plataforma SaaS self-service
--
-- Problema: profiles.approved DEFAULT false bloqueava todos
-- os novos usuários que se cadastravam sozinhos no sistema.
--
-- Solução:
--  1. Aprovar todos os usuários existentes
--  2. Alterar trigger handle_new_user para criar perfil aprovado
--  3. Alterar DEFAULT da coluna para true
-- ============================================================

-- 1. Aprovar todos os usuários existentes que estavam bloqueados
UPDATE public.profiles
SET approved = true
WHERE approved = false;

-- 2. Alterar o DEFAULT da coluna approved para true
ALTER TABLE public.profiles
  ALTER COLUMN approved SET DEFAULT true;

-- 3. Atualizar trigger para criar novos usuários já aprovados
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, approved)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    ),
    true  -- SaaS self-service: auto-aprovado
  )
  ON CONFLICT (user_id) DO UPDATE
    SET approved = true
    WHERE public.profiles.approved = false;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
