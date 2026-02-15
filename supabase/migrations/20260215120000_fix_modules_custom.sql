/*
  # Fix modules persistence for custom access

  1. Ensure set_modules_by_role does not overwrite custom modules on update
  2. Keep defaults up to date (including custos_clinicas)
  3. Refresh handle_new_auth_user defaults
*/

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
        'custos_clinicas', 'contas_a_pagar', 'pedidos_de_compra', 'controle_uber'
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

DROP TRIGGER IF EXISTS set_modules_on_role_change ON public.users;
CREATE TRIGGER set_modules_on_role_change
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION set_modules_by_role();

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
        'custos_clinicas', 'contas_a_pagar', 'pedidos_de_compra', 'controle_uber'
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
