-- Restore schema objects used by the deployed Hub without replaying historical
-- data migrations. This is safe to rerun and preserves existing user data.

BEGIN;

-- Tables absent from the active project but still used by the application.
CREATE TABLE IF NOT EXISTS public.controle_uber (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competencia date NOT NULL,
  data date NOT NULL,
  saida_hora time,
  retorno_hora time,
  valor_saida numeric(12, 2) NOT NULL DEFAULT 0,
  valor_retorno numeric(12, 2) NOT NULL DEFAULT 0,
  servico text,
  saida_local text,
  destino text,
  tipo text,
  pessoa_1 text,
  pessoa_2 text,
  pessoa_3 text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_controle_uber_competencia
  ON public.controle_uber(competencia);
CREATE INDEX IF NOT EXISTS idx_controle_uber_data
  ON public.controle_uber(data);
CREATE INDEX IF NOT EXISTS idx_controle_uber_user_id
  ON public.controle_uber(user_id);
ALTER TABLE public.controle_uber ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.controle_uber TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.visitas_clinicas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL,
  servico text NOT NULL,
  clinica text NOT NULL,
  pessoa_1 text,
  pessoa_2 text,
  pessoa_3 text,
  status text NOT NULL DEFAULT 'pendente',
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT visitas_clinicas_status_check
    CHECK (status IN ('concluido', 'pendente', 'atrasado')),
  CONSTRAINT visitas_clinicas_clinica_check
    CHECK (clinica IN ('Parangaba', 'Bezerra', 'Aguanambi'))
);

CREATE INDEX IF NOT EXISTS idx_visitas_clinicas_data
  ON public.visitas_clinicas(data);
CREATE INDEX IF NOT EXISTS idx_visitas_clinicas_status
  ON public.visitas_clinicas(status);
CREATE INDEX IF NOT EXISTS idx_visitas_clinicas_user_id
  ON public.visitas_clinicas(user_id);
ALTER TABLE public.visitas_clinicas ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visitas_clinicas TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP POLICY IF EXISTS visitas_clinicas_module_read ON public.visitas_clinicas;
CREATE POLICY visitas_clinicas_module_read ON public.visitas_clinicas
  FOR SELECT TO authenticated USING (has_module_access('visitas_clinicas'));
DROP POLICY IF EXISTS visitas_clinicas_module_manage ON public.visitas_clinicas;
CREATE POLICY visitas_clinicas_module_manage ON public.visitas_clinicas
  FOR ALL TO authenticated
  USING (has_module_edit_access('visitas_clinicas'))
  WITH CHECK (has_module_edit_access('visitas_clinicas'));

DROP POLICY IF EXISTS controle_uber_read_admin ON public.controle_uber;
CREATE POLICY controle_uber_read_admin ON public.controle_uber
  FOR SELECT TO authenticated USING (has_module_access('controle_uber'));
DROP POLICY IF EXISTS controle_uber_write_admin ON public.controle_uber;
CREATE POLICY controle_uber_write_admin ON public.controle_uber
  FOR ALL TO authenticated
  USING (has_module_edit_access('controle_uber'))
  WITH CHECK (has_module_edit_access('controle_uber'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_controle_uber_updated_at'
      AND tgrelid = 'public.controle_uber'::regclass
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER update_controle_uber_updated_at
      BEFORE UPDATE ON public.controle_uber
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_visitas_clinicas_updated_at'
      AND tgrelid = 'public.visitas_clinicas'::regclass
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER update_visitas_clinicas_updated_at
      BEFORE UPDATE ON public.visitas_clinicas
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- The deployed frontend already requests this metric.
ALTER TABLE public.google_workspace_accounts
  ADD COLUMN IF NOT EXISTS gmail_usage_mb numeric;

/*
  # Module edit permissions (read vs write)

  1. Add `edit_modules` to `public.users`
  2. Keep role defaults and auth sync with `modules` + `edit_modules`
  3. Add `has_module_edit_access(module_name text)`
  4. Apply write-policy hardening:
     - write policies that currently use `has_module_access(...)` now require `has_module_edit_access(...)`
     - update remaining module policies to split read (access) and write (edit)
*/

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS edit_modules text[] NOT NULL DEFAULT ARRAY[]::text[];

UPDATE public.users
SET edit_modules = COALESCE(modules, ARRAY[]::text[])
WHERE edit_modules IS NULL
   OR array_length(edit_modules, 1) IS NULL;

UPDATE public.users u
SET modules = COALESCE(
  (
    SELECT array_agg(m ORDER BY m)
    FROM (
      SELECT DISTINCT module_name AS m
      FROM unnest(COALESCE(u.modules, ARRAY[]::text[])) module_name
      WHERE module_name IS NOT NULL
        AND btrim(module_name) <> ''
    ) modules_set
  ),
  ARRAY[]::text[]
);

UPDATE public.users u
SET edit_modules = COALESCE(
  (
    SELECT array_agg(m ORDER BY m)
    FROM (
      SELECT DISTINCT edit_name AS m
      FROM unnest(COALESCE(u.edit_modules, ARRAY[]::text[])) edit_name
      WHERE edit_name IS NOT NULL
        AND btrim(edit_name) <> ''
        AND edit_name = ANY(COALESCE(u.modules, ARRAY[]::text[]))
    ) edit_set
  ),
  ARRAY[]::text[]
);

CREATE OR REPLACE FUNCTION has_module_access(module_name text)
RETURNS boolean AS $$
DECLARE
  user_modules text[];
  user_active boolean;
  user_role text;
BEGIN
  SELECT modules, is_active, role
    INTO user_modules, user_active, user_role
  FROM public.users
  WHERE auth_uid = auth.uid();

  IF user_active IS NOT TRUE THEN
    RETURN false;
  END IF;

  IF user_role = 'owner' THEN
    RETURN true;
  END IF;

  IF user_modules IS NULL THEN
    RETURN false;
  END IF;

  RETURN module_name = ANY(user_modules);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION has_module_edit_access(module_name text)
RETURNS boolean AS $$
DECLARE
  user_modules text[];
  user_edit_modules text[];
  user_active boolean;
  user_role text;
BEGIN
  SELECT modules, edit_modules, is_active, role
    INTO user_modules, user_edit_modules, user_active, user_role
  FROM public.users
  WHERE auth_uid = auth.uid();

  IF user_active IS NOT TRUE THEN
    RETURN false;
  END IF;

  IF user_role = 'owner' THEN
    RETURN true;
  END IF;

  IF user_modules IS NULL OR user_edit_modules IS NULL THEN
    RETURN false;
  END IF;

  RETURN module_name = ANY(user_modules) AND module_name = ANY(user_edit_modules);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION has_module_access TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION has_module_edit_access TO authenticated, anon, service_role;

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
        'controle_empresas', 'controle_uber', 'visitas_clinicas', 'pedidos_de_compra'
      ];
    WHEN 'admin' THEN
      default_modules := ARRAY[
        'usuarios', 'acessos', 'pessoal', 'teams', 'win_users',
        'rateio_claro', 'rateio_google', 'contas_a_pagar', 'rateio_mkm',
        'controle_empresas', 'controle_uber', 'visitas_clinicas', 'pedidos_de_compra'
      ];
    WHEN 'financeiro' THEN
      default_modules := ARRAY[
        'rateio_claro', 'rateio_google', 'rateio_mkm', 'controle_empresas', 'visitas_clinicas', 'contas_a_pagar', 'pedidos_de_compra', 'controle_uber'
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
    IF NEW.edit_modules IS NULL OR array_length(NEW.edit_modules, 1) IS NULL THEN
      NEW.edit_modules := NEW.modules;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      IF NEW.modules IS DISTINCT FROM OLD.modules OR NEW.edit_modules IS DISTINCT FROM OLD.edit_modules THEN
        NULL;
      ELSE
        NEW.modules := default_modules;
        NEW.edit_modules := default_modules;
      END IF;
    ELSE
      IF NEW.modules IS NULL THEN
        NEW.modules := OLD.modules;
      END IF;
      IF NEW.edit_modules IS NULL THEN
        NEW.edit_modules := OLD.edit_modules;
      END IF;
    END IF;
  END IF;

  NEW.modules := COALESCE(
    (
      SELECT array_agg(m ORDER BY m)
      FROM (
        SELECT DISTINCT module_name AS m
        FROM unnest(COALESCE(NEW.modules, ARRAY[]::text[])) module_name
        WHERE module_name IS NOT NULL
          AND btrim(module_name) <> ''
      ) modules_set
    ),
    ARRAY[]::text[]
  );

  NEW.edit_modules := COALESCE(
    (
      SELECT array_agg(m ORDER BY m)
      FROM (
        SELECT DISTINCT edit_name AS m
        FROM unnest(COALESCE(NEW.edit_modules, ARRAY[]::text[])) edit_name
        WHERE edit_name IS NOT NULL
          AND btrim(edit_name) <> ''
          AND edit_name = ANY(NEW.modules)
      ) edit_set
    ),
    ARRAY[]::text[]
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
        'controle_empresas', 'controle_uber', 'visitas_clinicas', 'pedidos_de_compra'
      ];
    WHEN 'admin' THEN
      user_modules := ARRAY[
        'usuarios', 'acessos', 'pessoal', 'teams', 'win_users',
        'rateio_claro', 'rateio_google', 'contas_a_pagar', 'rateio_mkm',
        'controle_empresas', 'controle_uber', 'visitas_clinicas', 'pedidos_de_compra'
      ];
    WHEN 'financeiro' THEN
      user_modules := ARRAY[
        'rateio_claro', 'rateio_google', 'rateio_mkm', 'controle_empresas', 'visitas_clinicas', 'contas_a_pagar', 'pedidos_de_compra', 'controle_uber'
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
    edit_modules,
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
    edit_modules = EXCLUDED.edit_modules,
    is_active = EXCLUDED.is_active,
    pass = EXCLUDED.pass,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

UPDATE public.users
SET edit_modules = modules
WHERE role = 'owner';

DO $$
DECLARE
  rec record;
  roles_sql text;
  new_qual text;
  new_with_check text;
  create_sql text;
BEGIN
  FOR rec IN
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND cmd <> 'SELECT'
      AND (
        coalesce(qual, '') LIKE '%has_module_access(%'
        OR coalesce(with_check, '') LIKE '%has_module_access(%'
      )
  LOOP
    new_qual := CASE
      WHEN rec.qual IS NULL THEN NULL
      ELSE replace(rec.qual, 'has_module_access(', 'has_module_edit_access(')
    END;
    new_with_check := CASE
      WHEN rec.with_check IS NULL THEN NULL
      ELSE replace(rec.with_check, 'has_module_access(', 'has_module_edit_access(')
    END;

    roles_sql := CASE
      WHEN rec.roles IS NULL OR array_length(rec.roles, 1) IS NULL THEN 'PUBLIC'
      ELSE (
        SELECT string_agg(
          CASE
            WHEN lower(role_name) = 'public' THEN 'PUBLIC'
            ELSE quote_ident(role_name)
          END,
          ', '
        )
        FROM unnest(rec.roles) AS role_name
      )
    END;

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', rec.policyname, rec.schemaname, rec.tablename);

    create_sql := format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s',
      rec.policyname,
      rec.schemaname,
      rec.tablename,
      rec.permissive,
      rec.cmd,
      roles_sql
    );

    IF new_qual IS NOT NULL THEN
      create_sql := create_sql || format(' USING (%s)', new_qual);
    END IF;
    IF new_with_check IS NOT NULL THEN
      create_sql := create_sql || format(' WITH CHECK (%s)', new_with_check);
    END IF;

    EXECUTE create_sql;
  END LOOP;
END $$;

DROP POLICY IF EXISTS "centros_custo_mkm_read" ON public.centros_custo_mkm;
CREATE POLICY "centros_custo_mkm_read"
  ON public.centros_custo_mkm
  FOR SELECT
  TO authenticated
  USING (has_module_access('rateio_mkm'));

DROP POLICY IF EXISTS "centros_custo_mkm_write_admin" ON public.centros_custo_mkm;
CREATE POLICY "centros_custo_mkm_write_admin"
  ON public.centros_custo_mkm
  FOR ALL
  TO authenticated
  USING (has_module_edit_access('rateio_mkm'))
  WITH CHECK (has_module_edit_access('rateio_mkm'));

DROP POLICY IF EXISTS "rateio_mkm_read" ON public.rateio_mkm;
CREATE POLICY "rateio_mkm_read"
  ON public.rateio_mkm
  FOR SELECT
  TO authenticated
  USING (has_module_access('rateio_mkm'));

DROP POLICY IF EXISTS "rateio_mkm_write_admin" ON public.rateio_mkm;
CREATE POLICY "rateio_mkm_write_admin"
  ON public.rateio_mkm
  FOR ALL
  TO authenticated
  USING (has_module_edit_access('rateio_mkm'))
  WITH CHECK (has_module_edit_access('rateio_mkm'));

DROP POLICY IF EXISTS "controle_uber_read_admin" ON public.controle_uber;
CREATE POLICY "controle_uber_read_admin"
  ON public.controle_uber
  FOR SELECT
  TO authenticated
  USING (has_module_access('controle_uber'));

DROP POLICY IF EXISTS "controle_uber_write_admin" ON public.controle_uber;
CREATE POLICY "controle_uber_write_admin"
  ON public.controle_uber
  FOR ALL
  TO authenticated
  USING (has_module_edit_access('controle_uber'))
  WITH CHECK (has_module_edit_access('controle_uber'));

DROP POLICY IF EXISTS "pc_protocolos_auth_all" ON public.pc_protocolos;
DROP POLICY IF EXISTS "pc_protocolo_itens_auth_all" ON public.pc_protocolo_itens;
DROP POLICY IF EXISTS "pc_mensal_itens_auth_all" ON public.pc_mensal_itens;
DROP POLICY IF EXISTS "pc_protocolos_module_read" ON public.pc_protocolos;
DROP POLICY IF EXISTS "pc_protocolos_module_manage" ON public.pc_protocolos;
DROP POLICY IF EXISTS "pc_protocolo_itens_module_read" ON public.pc_protocolo_itens;
DROP POLICY IF EXISTS "pc_protocolo_itens_module_manage" ON public.pc_protocolo_itens;
DROP POLICY IF EXISTS "pc_mensal_itens_module_read" ON public.pc_mensal_itens;
DROP POLICY IF EXISTS "pc_mensal_itens_module_manage" ON public.pc_mensal_itens;

CREATE POLICY "pc_protocolos_module_read"
  ON public.pc_protocolos
  FOR SELECT
  TO authenticated
  USING (has_module_access('pedidos_de_compra'));

CREATE POLICY "pc_protocolos_module_manage"
  ON public.pc_protocolos
  FOR ALL
  TO authenticated
  USING (has_module_edit_access('pedidos_de_compra'))
  WITH CHECK (has_module_edit_access('pedidos_de_compra'));

CREATE POLICY "pc_protocolo_itens_module_read"
  ON public.pc_protocolo_itens
  FOR SELECT
  TO authenticated
  USING (has_module_access('pedidos_de_compra'));

CREATE POLICY "pc_protocolo_itens_module_manage"
  ON public.pc_protocolo_itens
  FOR ALL
  TO authenticated
  USING (has_module_edit_access('pedidos_de_compra'))
  WITH CHECK (has_module_edit_access('pedidos_de_compra'));

CREATE POLICY "pc_mensal_itens_module_read"
  ON public.pc_mensal_itens
  FOR SELECT
  TO authenticated
  USING (has_module_access('pedidos_de_compra'));

CREATE POLICY "pc_mensal_itens_module_manage"
  ON public.pc_mensal_itens
  FOR ALL
  TO authenticated
  USING (has_module_edit_access('pedidos_de_compra'))
  WITH CHECK (has_module_edit_access('pedidos_de_compra'));

-- Bring existing profiles up to the role defaults used by the current Hub,
-- while retaining any custom module assignments already present.
UPDATE public.users AS u
SET modules = (
      SELECT array_agg(DISTINCT module_name ORDER BY module_name)
      FROM unnest(COALESCE(u.modules, ARRAY[]::text[]) || CASE u.role
        WHEN 'owner' THEN ARRAY[
          'usuarios', 'acessos', 'pessoal', 'teams', 'win_users', 'rateio_claro',
          'rateio_google', 'rateio_mkm', 'contas_a_pagar', 'controle_empresas',
          'controle_uber', 'visitas_clinicas', 'pedidos_de_compra'
        ]::text[]
        WHEN 'admin' THEN ARRAY[
          'usuarios', 'acessos', 'pessoal', 'teams', 'win_users', 'rateio_claro',
          'rateio_google', 'rateio_mkm', 'contas_a_pagar', 'controle_empresas',
          'controle_uber', 'visitas_clinicas', 'pedidos_de_compra'
        ]::text[]
        WHEN 'financeiro' THEN ARRAY[
          'rateio_claro', 'rateio_google', 'rateio_mkm', 'contas_a_pagar',
          'controle_empresas', 'controle_uber', 'visitas_clinicas', 'pedidos_de_compra'
        ]::text[]
        ELSE ARRAY['acessos', 'pessoal', 'teams', 'win_users']::text[]
      END) AS assigned(module_name)
    ),
    edit_modules = (
      SELECT array_agg(DISTINCT module_name ORDER BY module_name)
      FROM unnest(COALESCE(u.edit_modules, ARRAY[]::text[]) || CASE u.role
        WHEN 'owner' THEN ARRAY[
          'usuarios', 'acessos', 'pessoal', 'teams', 'win_users', 'rateio_claro',
          'rateio_google', 'rateio_mkm', 'contas_a_pagar', 'controle_empresas',
          'controle_uber', 'visitas_clinicas', 'pedidos_de_compra'
        ]::text[]
        WHEN 'admin' THEN ARRAY[
          'usuarios', 'acessos', 'pessoal', 'teams', 'win_users', 'rateio_claro',
          'rateio_google', 'rateio_mkm', 'contas_a_pagar', 'controle_empresas',
          'controle_uber', 'visitas_clinicas', 'pedidos_de_compra'
        ]::text[]
        WHEN 'financeiro' THEN ARRAY[
          'rateio_claro', 'rateio_google', 'rateio_mkm', 'contas_a_pagar',
          'controle_empresas', 'controle_uber', 'visitas_clinicas', 'pedidos_de_compra'
        ]::text[]
        ELSE ARRAY['acessos', 'pessoal', 'teams', 'win_users']::text[]
      END) AS assigned(module_name)
    ),
    updated_at = NOW()
WHERE u.role IN ('owner', 'admin', 'financeiro', 'usuario');

NOTIFY pgrst, 'reload schema';

COMMIT;
