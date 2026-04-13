-- Add 'viewer' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'viewer';

-- Add 'categoria' column to fornecedores
ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS categoria text DEFAULT NULL;