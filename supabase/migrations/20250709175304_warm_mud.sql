/*
  # Fix Authentication System and RBAC

  1. Database Functions
    - Create function to sync auth.users with public.users
    - Create function to handle new user registration
    - Create function to check module access

  2. Triggers
    - Auto-create public.users when auth.users is created
    - Auto-sync user data between tables

  3. Security Policies
    - Admin: Full access to all modules
    - Financeiro: Access to rateio_claro and rateio_google
    - Usuario: Access to acessos, teams, and win_users

  4. Data Integrity
    - Ensure all auth users have corresponding public users
    - Maintain proper role-based module assignments
*/

-- Drop existing functions and triggers to recreate them properly
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS sync_auth_user_to_public_users() CASCADE;
DROP FUNCTION IF EXISTS handle_new_auth_user() CASCADE;

-- Create function to handle new auth user creation
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role text := 'usuario';
  user_modules text[] := ARRAY['acessos', 'teams', 'win_users'];
BEGIN
  -- Extract role from user metadata if provided
  IF NEW.raw_user_meta_data ? 'role' THEN
    user_role := NEW.raw_user_meta_data->>'role';
  END IF;

  -- Set modules based on role
  CASE user_role
    WHEN 'admin' THEN
      user_modules := ARRAY['usuarios', 'acessos', 'teams', 'win_users', 'rateio_claro', 'rateio_google'];
    WHEN 'financeiro' THEN
      user_modules := ARRAY['rateio_claro', 'rateio_google'];
    WHEN 'usuario' THEN
      user_modules := ARRAY['acessos', 'teams', 'win_users'];
    ELSE
      user_modules := ARRAY['acessos', 'teams', 'win_users'];
  END CASE;

  -- Insert into public.users
  INSERT INTO public.users (
    id,
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
    gen_random_uuid(),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    user_role,
    user_modules,
    true,
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'password', ''),
    NOW(),
    NOW()
  ) ON CONFLICT (auth_uid) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, users.name),
    role = COALESCE(EXCLUDED.role, users.role),
    modules = EXCLUDED.modules,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to sync existing auth users
CREATE OR REPLACE FUNCTION sync_auth_user_to_public_users()
RETURNS void AS $$
DECLARE
  auth_user RECORD;
  user_role text;
  user_modules text[];
BEGIN
  -- Loop through all auth users that don't have a corresponding public user
  FOR auth_user IN 
    SELECT au.id, au.email, au.raw_user_meta_data
    FROM auth.users au
    LEFT JOIN public.users pu ON au.id = pu.auth_uid
    WHERE pu.auth_uid IS NULL
  LOOP
    -- Determine role
    user_role := COALESCE(auth_user.raw_user_meta_data->>'role', 'usuario');
    
    -- Set modules based on role
    CASE user_role
      WHEN 'admin' THEN
        user_modules := ARRAY['usuarios', 'acessos', 'teams', 'win_users', 'rateio_claro', 'rateio_google'];
      WHEN 'financeiro' THEN
        user_modules := ARRAY['rateio_claro', 'rateio_google'];
      WHEN 'usuario' THEN
        user_modules := ARRAY['acessos', 'teams', 'win_users'];
      ELSE
        user_modules := ARRAY['acessos', 'teams', 'win_users'];
    END CASE;

    -- Insert into public.users
    INSERT INTO public.users (
      id,
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
      gen_random_uuid(),
      auth_user.email,
      COALESCE(auth_user.raw_user_meta_data->>'name', split_part(auth_user.email, '@', 1)),
      user_role,
      user_modules,
      true,
      auth_user.id,
      COALESCE(auth_user.raw_user_meta_data->>'password', ''),
      NOW(),
      NOW()
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users to automatically create public.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- Sync existing auth users
SELECT sync_auth_user_to_public_users();

-- Update has_module_access function to be more robust
CREATE OR REPLACE FUNCTION has_module_access(module_name text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE auth_uid = auth.uid() 
    AND module_name = ANY(modules)
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION has_module_access TO authenticated;
GRANT EXECUTE ON FUNCTION sync_auth_user_to_public_users TO service_role;

-- Ensure admin user exists
DO $$
BEGIN
  -- Check if admin user exists in auth.users
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@serverkey.com') THEN
    -- Insert into auth.users first
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'gen_salt') THEN
      EXECUTE $sql$
        INSERT INTO auth.users (
          instance_id,
          id,
          aud,
          role,
          email,
          encrypted_password,
          email_confirmed_at,
          raw_user_meta_data,
          created_at,
          updated_at,
          confirmation_token,
          email_change,
          email_change_token_new,
          recovery_token
        ) VALUES (
          '00000000-0000-0000-0000-000000000000',
          gen_random_uuid(),
          'authenticated',
          'authenticated',
          'admin@serverkey.com',
          crypt('admin123', gen_salt('bf')),
          NOW(),
          '{"name": "Administrador", "role": "admin"}',
          NOW(),
          NOW(),
          '',
          '',
          '',
          ''
        );
      $sql$;
    ELSE
      RAISE NOTICE 'Skipping auth.users admin insert: pgcrypto (gen_salt) not available.';
    END IF;
  END IF;

  -- Ensure admin user exists in public.users
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE email = 'admin@serverkey.com') THEN
    INSERT INTO public.users (email, name, role, is_active, pass) VALUES (
      'admin@serverkey.com',
      'Administrador',
      'admin',
      true,
      'admin123'
    ) ON CONFLICT (email) DO UPDATE SET
      role = 'admin',
      is_active = true;
  END IF;
END $$;

-- Update all existing users to have proper auth_uid links
UPDATE public.users 
SET auth_uid = (
  SELECT au.id 
  FROM auth.users au 
  WHERE au.email = users.email 
  LIMIT 1
)
WHERE auth_uid IS NULL;

-- Ensure all users have proper modules based on their role
UPDATE public.users 
SET modules = CASE 
  WHEN role = 'admin' THEN ARRAY['usuarios', 'acessos', 'teams', 'win_users', 'rateio_claro', 'rateio_google']
  WHEN role = 'financeiro' THEN ARRAY['rateio_claro', 'rateio_google']
  WHEN role = 'usuario' THEN ARRAY['acessos', 'teams', 'win_users']
  ELSE ARRAY['acessos', 'teams', 'win_users']
END
WHERE modules IS NULL OR array_length(modules, 1) IS NULL;
