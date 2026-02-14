/*
  # Custos das Clinicas persistence

  1. New Tables
    - custos_clinicas_movements
    - custos_clinicas_unify
    - custos_clinicas_carryover

  2. Security
    - Enable RLS
    - Policies for module access

  3. Roles
    - Include custos_clinicas in default modules
*/

-- Ensure pgcrypto is available for gen_random_uuid
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
SET search_path = public, extensions;

CREATE TABLE IF NOT EXISTS public.custos_clinicas_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competencia date NOT NULL,
  clinic text NOT NULL,
  product text NOT NULL,
  store text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_cost numeric(12, 2) NOT NULL DEFAULT 0,
  total_cost numeric(12, 2) NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custos_clinicas_movements_competencia
  ON public.custos_clinicas_movements(competencia);

CREATE INDEX IF NOT EXISTS idx_custos_clinicas_movements_clinic
  ON public.custos_clinicas_movements(clinic);

ALTER TABLE public.custos_clinicas_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "custos_clinicas_movements_read" ON public.custos_clinicas_movements;
DROP POLICY IF EXISTS "custos_clinicas_movements_write" ON public.custos_clinicas_movements;

CREATE POLICY "custos_clinicas_movements_read"
  ON public.custos_clinicas_movements
  FOR SELECT
  TO authenticated
  USING (has_module_access('custos_clinicas'));

CREATE POLICY "custos_clinicas_movements_write"
  ON public.custos_clinicas_movements
  FOR ALL
  TO authenticated
  USING (has_module_access('custos_clinicas'))
  WITH CHECK (has_module_access('custos_clinicas'));

CREATE TABLE IF NOT EXISTS public.custos_clinicas_unify (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name text NOT NULL,
  unified_name text NOT NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'custos_clinicas_unify_source_unique'
  ) THEN
    ALTER TABLE public.custos_clinicas_unify
      ADD CONSTRAINT custos_clinicas_unify_source_unique UNIQUE (source_name);
  END IF;
END $$;

ALTER TABLE public.custos_clinicas_unify ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "custos_clinicas_unify_read" ON public.custos_clinicas_unify;
DROP POLICY IF EXISTS "custos_clinicas_unify_write" ON public.custos_clinicas_unify;

CREATE POLICY "custos_clinicas_unify_read"
  ON public.custos_clinicas_unify
  FOR SELECT
  TO authenticated
  USING (has_module_access('custos_clinicas'));

CREATE POLICY "custos_clinicas_unify_write"
  ON public.custos_clinicas_unify
  FOR ALL
  TO authenticated
  USING (has_module_access('custos_clinicas'))
  WITH CHECK (has_module_access('custos_clinicas'));

CREATE TABLE IF NOT EXISTS public.custos_clinicas_carryover (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competencia date NOT NULL,
  product text NOT NULL,
  store text NOT NULL,
  quantity integer NOT NULL CHECK (quantity >= 0),
  total_cost numeric(12, 2) NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'custos_clinicas_carryover_unique'
  ) THEN
    ALTER TABLE public.custos_clinicas_carryover
      ADD CONSTRAINT custos_clinicas_carryover_unique UNIQUE (competencia, product, store);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_custos_clinicas_carryover_competencia
  ON public.custos_clinicas_carryover(competencia);

ALTER TABLE public.custos_clinicas_carryover ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "custos_clinicas_carryover_read" ON public.custos_clinicas_carryover;
DROP POLICY IF EXISTS "custos_clinicas_carryover_write" ON public.custos_clinicas_carryover;

CREATE POLICY "custos_clinicas_carryover_read"
  ON public.custos_clinicas_carryover
  FOR SELECT
  TO authenticated
  USING (has_module_access('custos_clinicas'));

CREATE POLICY "custos_clinicas_carryover_write"
  ON public.custos_clinicas_carryover
  FOR ALL
  TO authenticated
  USING (has_module_access('custos_clinicas'))
  WITH CHECK (has_module_access('custos_clinicas'));

-- Update set_modules_by_role to include custos_clinicas
CREATE OR REPLACE FUNCTION set_modules_by_role()
RETURNS TRIGGER AS $$
DECLARE
  default_modules text[];
BEGIN
  CASE NEW.role
    WHEN 'owner' THEN
      default_modules := ARRAY[
        'usuarios', 'acessos', 'pessoal', 'teams', 'win_users',
        'rateio_claro', 'rateio_google', 'contas_a_pagar', 'rateio_mkm',
        'controle_empresas', 'controle_uber', 'visitas_clinicas', 'pedidos_de_compra',
        'custos_clinicas'
      ];
    WHEN 'admin' THEN
      default_modules := ARRAY[
        'usuarios', 'acessos', 'pessoal', 'teams', 'win_users',
        'rateio_claro', 'rateio_google', 'contas_a_pagar', 'rateio_mkm',
        'controle_empresas', 'controle_uber', 'visitas_clinicas',
        'custos_clinicas'
      ];
    WHEN 'financeiro' THEN
      default_modules := ARRAY[
        'rateio_claro', 'rateio_google', 'rateio_mkm', 'controle_empresas', 'visitas_clinicas',
        'custos_clinicas'
      ];
    WHEN 'usuario' THEN
      default_modules := ARRAY['acessos', 'pessoal', 'teams', 'win_users'];
    ELSE
      default_modules := ARRAY[]::text[];
  END CASE;

  IF TG_OP = 'INSERT' THEN
    IF NEW.modules IS NULL OR array_length(NEW.modules, 1) IS NULL THEN
      NEW.modules := default_modules;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role THEN
    IF NEW.modules IS DISTINCT FROM OLD.modules THEN
      RETURN NEW;
    END IF;
    NEW.modules := default_modules;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update handle_new_auth_user defaults to include custos_clinicas
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role text := 'usuario';
  user_modules text[] := ARRAY['acessos', 'pessoal', 'teams', 'win_users'];
  user_name text;
  user_password text := '';
BEGIN
  IF NEW.raw_user_meta_data IS NOT NULL THEN
    IF NEW.raw_user_meta_data ? 'role' THEN
      user_role := NEW.raw_user_meta_data->>'role';
    END IF;
    IF NEW.raw_user_meta_data ? 'name' THEN
      user_name := NEW.raw_user_meta_data->>'name';
    END IF;
    IF NEW.raw_user_meta_data ? 'password' THEN
      user_password := NEW.raw_user_meta_data->>'password';
    END IF;
  END IF;

  IF user_name IS NULL OR user_name = '' THEN
    user_name := split_part(NEW.email, '@', 1);
  END IF;

  CASE user_role
    WHEN 'owner' THEN
      user_modules := ARRAY[
        'usuarios', 'acessos', 'pessoal', 'teams', 'win_users',
        'rateio_claro', 'rateio_google', 'contas_a_pagar', 'rateio_mkm',
        'controle_empresas', 'controle_uber', 'visitas_clinicas', 'pedidos_de_compra',
        'custos_clinicas'
      ];
    WHEN 'admin' THEN
      user_modules := ARRAY[
        'usuarios', 'acessos', 'pessoal', 'teams', 'win_users',
        'rateio_claro', 'rateio_google', 'contas_a_pagar', 'rateio_mkm',
        'controle_empresas', 'controle_uber', 'visitas_clinicas',
        'custos_clinicas'
      ];
    WHEN 'financeiro' THEN
      user_modules := ARRAY[
        'rateio_claro', 'rateio_google', 'rateio_mkm', 'controle_empresas', 'visitas_clinicas',
        'custos_clinicas'
      ];
    WHEN 'usuario' THEN
      user_modules := ARRAY['acessos', 'pessoal', 'teams', 'win_users'];
    ELSE
      user_modules := ARRAY['acessos', 'pessoal', 'teams', 'win_users'];
  END CASE;

  INSERT INTO public.users (
    email,
    name,
    role,
    modules,
    is_active,
    auth_uid,
    pass,
    created_at,
    updated_at
  ) VALUES (
    NEW.email,
    user_name,
    user_role,
    user_modules,
    true,
    NEW.id,
    user_password,
    NOW(),
    NOW()
  ) ON CONFLICT (auth_uid) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, users.name),
    role = EXCLUDED.role,
    modules = EXCLUDED.modules,
    is_active = EXCLUDED.is_active,
    pass = EXCLUDED.pass,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add custos_clinicas to existing users
UPDATE public.users
SET modules = array_append(coalesce(modules, ARRAY[]::text[]), 'custos_clinicas')
WHERE role IN ('owner', 'admin', 'financeiro')
  AND NOT (coalesce(modules, ARRAY[]::text[]) @> ARRAY['custos_clinicas']);
