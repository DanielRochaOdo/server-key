/*
  # Controle Empresas

  1. New Tables
    - `controle_empresas`
      - `id` (uuid, primary key)
      - `mes` (date, required)
      - `empresa` (text, required)
      - `quantidade` (integer, required)
      - `user_id` (uuid, foreign key)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS
    - Users can manage their own data with module access
    - Users can read with module access

  3. Role Modules
    - Include `controle_empresas` for admin and financeiro
*/

-- Ensure pgcrypto is available for gen_random_uuid
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
SET search_path = public, extensions;

CREATE TABLE IF NOT EXISTS public.controle_empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mes date NOT NULL,
  empresa text NOT NULL,
  quantidade integer NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_controle_empresas_unique
  ON public.controle_empresas(mes, empresa, user_id);

CREATE INDEX IF NOT EXISTS idx_controle_empresas_user_id
  ON public.controle_empresas(user_id);

CREATE INDEX IF NOT EXISTS idx_controle_empresas_mes
  ON public.controle_empresas(mes);

ALTER TABLE public.controle_empresas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "controle_empresas_module_read"
  ON public.controle_empresas
  FOR SELECT
  TO authenticated
  USING (has_module_access('controle_empresas'));

CREATE POLICY "controle_empresas_module_manage_own"
  ON public.controle_empresas
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id AND has_module_access('controle_empresas'))
  WITH CHECK (auth.uid() = user_id AND has_module_access('controle_empresas'));

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
    WHERE trigger_name = 'update_controle_empresas_updated_at'
  ) THEN
    CREATE TRIGGER update_controle_empresas_updated_at
      BEFORE UPDATE ON public.controle_empresas
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Update set_modules_by_role to include controle_empresas
CREATE OR REPLACE FUNCTION set_modules_by_role()
RETURNS TRIGGER AS $$
BEGIN
  CASE NEW.role
    WHEN 'admin' THEN
      NEW.modules := ARRAY[
        'usuarios', 'acessos', 'pessoal', 'teams', 'win_users',
        'rateio_claro', 'rateio_google', 'contas_a_pagar', 'rateio_mkm',
        'controle_empresas'
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

-- Add controle_empresas to existing admin/financeiro users (idempotent)
UPDATE public.users
SET modules = array_append(coalesce(modules, ARRAY[]::text[]), 'controle_empresas')
WHERE role IN ('admin', 'financeiro')
  AND NOT (coalesce(modules, ARRAY[]::text[]) @> ARRAY['controle_empresas']);
