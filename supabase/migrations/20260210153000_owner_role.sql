/*
  # Add owner role and advanced user management

  1. Add owner to role check constraint
  2. Update is_admin / has_module_access and add is_owner
  3. Update set_modules_by_role to allow custom modules and owner defaults
  4. Update handle_new_auth_user to include owner + latest modules
*/

-- Update role constraint to include owner
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT c.conname INTO constraint_name
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE t.relname = 'users'
    AND n.nspname = 'public'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%role%'
    AND pg_get_constraintdef(c.oid) ILIKE '%admin%'
    AND pg_get_constraintdef(c.oid) ILIKE '%financeiro%'
    AND pg_get_constraintdef(c.oid) ILIKE '%usuario%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.users DROP CONSTRAINT IF EXISTS %I', constraint_name);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_role_check'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_role_check
      CHECK (role IN ('admin', 'owner', 'financeiro', 'usuario'));
  END IF;
END $$;

-- Update helper functions
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_uid = auth.uid()
      AND role IN ('admin', 'owner')
      AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_owner()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_uid = auth.uid()
      AND role = 'owner'
      AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION has_module_access(module_name text)
RETURNS boolean AS $$
DECLARE
  user_modules text[];
  user_active boolean;
  user_role text;
BEGIN
  SELECT modules, is_active, role INTO user_modules, user_active, user_role
  FROM public.users
  WHERE auth_uid = auth.uid();

  IF user_role = 'owner' AND user_active = true THEN
    RETURN true;
  END IF;

  IF user_modules IS NULL OR user_active IS NOT TRUE THEN
    RETURN false;
  END IF;

  RETURN module_name = ANY(user_modules);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION is_admin TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION is_owner TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION has_module_access TO authenticated, anon, service_role;

-- Ensure owner can read/update all users via RLS policies
DROP POLICY IF EXISTS "owners_can_read_all_users" ON public.users;
DROP POLICY IF EXISTS "owners_can_update_all_users" ON public.users;

CREATE POLICY "owners_can_read_all_users"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (is_owner());

CREATE POLICY "owners_can_update_all_users"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (is_owner())
  WITH CHECK (is_owner());

-- Allow custom modules when role changes (owner can define manually)
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
        'controle_empresas', 'controle_uber', 'visitas_clinicas'
      ];
    WHEN 'financeiro' THEN
      default_modules := ARRAY['rateio_claro', 'rateio_google', 'rateio_mkm', 'controle_empresas', 'visitas_clinicas'];
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

-- Update handle_new_auth_user to include owner and latest modules
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
        'controle_empresas', 'controle_uber', 'visitas_clinicas'
      ];
    WHEN 'financeiro' THEN
      user_modules := ARRAY['rateio_claro', 'rateio_google', 'rateio_mkm', 'controle_empresas', 'visitas_clinicas'];
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
    updated_at = NOW();

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in handle_new_auth_user trigger for %: %', NEW.email, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure owner modules are fully granted
UPDATE public.users
SET modules = ARRAY[
  'usuarios', 'acessos', 'pessoal', 'teams', 'win_users',
  'rateio_claro', 'rateio_google', 'contas_a_pagar', 'rateio_mkm',
  'controle_empresas', 'controle_uber', 'visitas_clinicas', 'pedidos_de_compra'
]
WHERE role = 'owner';
