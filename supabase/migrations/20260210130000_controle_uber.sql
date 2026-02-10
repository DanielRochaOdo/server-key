/*
  # Controle Uber

  1. New Tables
    - `controle_uber`
      - `id` (uuid, primary key)
      - `competencia` (date, required)
      - `data` (date, required)
      - `saida_hora` (time)
      - `retorno_hora` (time)
      - `valor` (numeric, required)
      - `servico` (text)
      - `saida_local` (text)
      - `destino` (text)
      - `tipo` (text)
      - `pessoa_1` (text)
      - `pessoa_2` (text)
      - `pessoa_3` (text)
      - `user_id` (uuid, foreign key)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS
    - Admin only

  3. Role Modules
    - Include `controle_uber` for admin
*/

-- Ensure pgcrypto is available for gen_random_uuid
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
SET search_path = public, extensions;

CREATE TABLE IF NOT EXISTS public.controle_uber (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competencia date NOT NULL,
  data date NOT NULL,
  saida_hora time,
  retorno_hora time,
  valor numeric(12, 2) NOT NULL DEFAULT 0,
  servico text,
  saida_local text,
  destino text,
  tipo text,
  pessoa_1 text,
  pessoa_2 text,
  pessoa_3 text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_controle_uber_competencia
  ON public.controle_uber(competencia);

CREATE INDEX IF NOT EXISTS idx_controle_uber_data
  ON public.controle_uber(data);

CREATE INDEX IF NOT EXISTS idx_controle_uber_user_id
  ON public.controle_uber(user_id);

ALTER TABLE public.controle_uber ENABLE ROW LEVEL SECURITY;

CREATE POLICY "controle_uber_read_admin"
  ON public.controle_uber
  FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "controle_uber_write_admin"
  ON public.controle_uber
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Ensure updated_at is managed consistently
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'update_controle_uber_updated_at'
  ) THEN
    CREATE TRIGGER update_controle_uber_updated_at
      BEFORE UPDATE ON public.controle_uber
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Update set_modules_by_role to include controle_uber for admin
CREATE OR REPLACE FUNCTION set_modules_by_role()
RETURNS TRIGGER AS $$
BEGIN
  CASE NEW.role
    WHEN 'admin' THEN
      NEW.modules := ARRAY[
        'usuarios', 'acessos', 'pessoal', 'teams', 'win_users',
        'rateio_claro', 'rateio_google', 'contas_a_pagar', 'rateio_mkm',
        'controle_empresas', 'controle_uber'
      ];
    WHEN 'financeiro' THEN
      NEW.modules := ARRAY['rateio_claro', 'rateio_google', 'rateio_mkm', 'controle_empresas'];
    WHEN 'usuario' THEN
      NEW.modules := ARRAY['acessos', 'pessoal', 'teams', 'win_users'];
    ELSE
      NEW.modules := ARRAY[]::text[];
  END CASE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add controle_uber to existing admin users (idempotent)
UPDATE public.users
SET modules = array_append(coalesce(modules, ARRAY[]::text[]), 'controle_uber')
WHERE role = 'admin'
  AND NOT (coalesce(modules, ARRAY[]::text[]) @> ARRAY['controle_uber']);

-- Remove controle_uber from non-admin users if present
UPDATE public.users
SET modules = array_remove(coalesce(modules, ARRAY[]::text[]), 'controle_uber')
WHERE role <> 'admin'
  AND (coalesce(modules, ARRAY[]::text[]) @> ARRAY['controle_uber']);
