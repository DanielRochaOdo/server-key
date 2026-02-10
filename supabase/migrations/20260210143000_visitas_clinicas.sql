/*
  # Visitas Clinicas

  1. New Table
    - visitas_clinicas
      - id (uuid, primary key)
      - data (date, required)
      - servico (text, required)
      - clinica (text, required)
      - pessoa_1 (text)
      - pessoa_2 (text)
      - pessoa_3 (text)
      - status (text, required)
      - user_id (uuid, foreign key)
      - created_at (timestamp)
      - updated_at (timestamp)

  2. Security
    - Enable RLS
    - Users with module access can read
    - Users can manage their own records

  3. Role Modules
    - Include visitas_clinicas for admin and financeiro
*/

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
SET search_path = public, extensions;

CREATE TABLE IF NOT EXISTS public.visitas_clinicas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL,
  servico text NOT NULL,
  clinica text NOT NULL,
  pessoa_1 text,
  pessoa_2 text,
  pessoa_3 text,
  status text NOT NULL DEFAULT 'pendente',
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'visitas_clinicas_status_check'
  ) THEN
    ALTER TABLE public.visitas_clinicas
      ADD CONSTRAINT visitas_clinicas_status_check
      CHECK (status IN ('concluido', 'pendente', 'atrasado'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_visitas_clinicas_data
  ON public.visitas_clinicas(data);

CREATE INDEX IF NOT EXISTS idx_visitas_clinicas_user_id
  ON public.visitas_clinicas(user_id);

CREATE INDEX IF NOT EXISTS idx_visitas_clinicas_status
  ON public.visitas_clinicas(status);

ALTER TABLE public.visitas_clinicas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "visitas_clinicas_module_read" ON public.visitas_clinicas;
DROP POLICY IF EXISTS "visitas_clinicas_module_manage_own" ON public.visitas_clinicas;

CREATE POLICY "visitas_clinicas_module_read"
  ON public.visitas_clinicas
  FOR SELECT
  TO authenticated
  USING (has_module_access('visitas_clinicas'));

CREATE POLICY "visitas_clinicas_module_manage_own"
  ON public.visitas_clinicas
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id AND has_module_access('visitas_clinicas'))
  WITH CHECK (auth.uid() = user_id AND has_module_access('visitas_clinicas'));

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
    WHERE trigger_name = 'update_visitas_clinicas_updated_at'
  ) THEN
    CREATE TRIGGER update_visitas_clinicas_updated_at
      BEFORE UPDATE ON public.visitas_clinicas
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION set_modules_by_role()
RETURNS TRIGGER AS $$
BEGIN
  CASE NEW.role
    WHEN 'admin' THEN
      NEW.modules := ARRAY[
        'usuarios', 'acessos', 'pessoal', 'teams', 'win_users',
        'rateio_claro', 'rateio_google', 'contas_a_pagar', 'rateio_mkm',
        'controle_empresas', 'controle_uber', 'visitas_clinicas'
      ];
    WHEN 'financeiro' THEN
      NEW.modules := ARRAY['rateio_claro', 'rateio_google', 'rateio_mkm', 'controle_empresas', 'visitas_clinicas'];
    WHEN 'usuario' THEN
      NEW.modules := ARRAY['acessos', 'pessoal', 'teams', 'win_users'];
    ELSE
      NEW.modules := ARRAY[]::text[];
  END CASE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

UPDATE public.users
SET modules = array_append(coalesce(modules, ARRAY[]::text[]), 'visitas_clinicas')
WHERE role IN ('admin', 'financeiro')
  AND NOT (coalesce(modules, ARRAY[]::text[]) @> ARRAY['visitas_clinicas']);

UPDATE public.users
SET modules = array_remove(coalesce(modules, ARRAY[]::text[]), 'visitas_clinicas')
WHERE role NOT IN ('admin', 'financeiro')
  AND (coalesce(modules, ARRAY[]::text[]) @> ARRAY['visitas_clinicas']);
