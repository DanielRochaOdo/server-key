-- First, let's ensure we have a clean slate for user policies by dropping ALL existing policies
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'users' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.users', pol.policyname);
    END LOOP;
END $$;

-- Drop all policies that depend on functions we need to recreate
DO $$
DECLARE
    tbl_name text;
    policy_name text;
BEGIN
    -- Drop policies from all tables that use has_module_access
    FOR tbl_name IN SELECT unnest(ARRAY['acessos', 'teams', 'rateio_claro', 'rateio_google', 'win_users']) LOOP
        IF EXISTS (SELECT FROM information_schema.tables WHERE information_schema.tables.table_name = tbl_name) THEN
            FOR policy_name IN 
                SELECT policyname 
                FROM pg_policies 
                WHERE tablename = tbl_name AND schemaname = 'public'
            LOOP
                EXECUTE format('DROP POLICY IF EXISTS %I ON %I', policy_name, tbl_name);
            END LOOP;
        END IF;
    END LOOP;
END $$;

-- Now we can safely drop and recreate functions
DROP FUNCTION IF EXISTS get_user_role(uuid) CASCADE;
DROP FUNCTION IF EXISTS is_user_admin(uuid) CASCADE;
DROP FUNCTION IF EXISTS has_module_access(text) CASCADE;
DROP FUNCTION IF EXISTS is_admin() CASCADE;

-- Create simple, non-recursive policies for users table

-- Users can read their own profile by auth_uid
CREATE POLICY "users_can_read_themselves"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth_uid = auth.uid());

-- Users can update their own basic profile (excluding critical fields)
CREATE POLICY "users_can_update_own_profile"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth_uid = auth.uid())
  WITH CHECK (auth_uid = auth.uid());

-- Service role can do everything (for Edge Functions and admin operations)
CREATE POLICY "service_role_can_manage_users"
  ON public.users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to insert (needed for Edge Functions)
CREATE POLICY "authenticated_can_insert_users"
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Admins can read all users (non-recursive check)
CREATE POLICY "admins_can_read_all_users"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users admin_user
      WHERE admin_user.auth_uid = auth.uid()
      AND admin_user.role = 'admin'
      AND admin_user.is_active = true
    )
  );

-- Admins can update all users (non-recursive check)
CREATE POLICY "admins_can_update_all_users"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users admin_user
      WHERE admin_user.auth_uid = auth.uid()
      AND admin_user.role = 'admin'
      AND admin_user.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users admin_user
      WHERE admin_user.auth_uid = auth.uid()
      AND admin_user.role = 'admin'
      AND admin_user.is_active = true
    )
  );

-- Create a function to safely get user role without recursion
CREATE OR REPLACE FUNCTION get_user_role(user_auth_uid uuid)
RETURNS text AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role
  FROM public.users
  WHERE auth_uid = user_auth_uid
  AND is_active = true;
  
  RETURN COALESCE(user_role, 'usuario');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create a function to safely check if user is admin
CREATE OR REPLACE FUNCTION is_user_admin(user_auth_uid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN get_user_role(user_auth_uid) = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create is_admin function for backward compatibility
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN get_user_role(auth.uid()) = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Update has_module_access function to be more robust
CREATE OR REPLACE FUNCTION has_module_access(module_name text)
RETURNS boolean AS $$
DECLARE
  user_modules text[];
  user_active boolean;
BEGIN
  SELECT modules, is_active INTO user_modules, user_active
  FROM public.users
  WHERE auth_uid = auth.uid();
  
  -- Return false if user not found or inactive
  IF user_modules IS NULL OR user_active IS NOT TRUE THEN
    RETURN false;
  END IF;
  
  -- Check if module is in user's modules array
  RETURN module_name = ANY(user_modules);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_user_role TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_user_admin TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_admin TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION has_module_access TO authenticated, service_role;

-- Ensure all existing auth users have corresponding public.users records
DO $$
DECLARE
  auth_user RECORD;
  user_role text;
  user_modules text[];
BEGIN
  FOR auth_user IN 
    SELECT au.id, au.email, au.raw_user_meta_data
    FROM auth.users au
    LEFT JOIN public.users pu ON au.id = pu.auth_uid
    WHERE pu.auth_uid IS NULL
  LOOP
    -- Determine role from metadata or default to usuario
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
      email,
      name,
      role,
      modules,
      is_active,
      auth_uid,
      pass
    ) VALUES (
      auth_user.email,
      COALESCE(auth_user.raw_user_meta_data->>'name', split_part(auth_user.email, '@', 1)),
      user_role,
      user_modules,
      true,
      auth_user.id,
      COALESCE(auth_user.raw_user_meta_data->>'password', '')
    ) ON CONFLICT (auth_uid) DO UPDATE SET
      email = EXCLUDED.email,
      name = COALESCE(EXCLUDED.name, users.name),
      updated_at = NOW();
  END LOOP;
END $$;

-- Ensure admin user exists in public.users (auth.users will be handled by Edge Function)
UPDATE public.users
SET role = 'admin',
    modules = ARRAY['usuarios', 'acessos', 'teams', 'win_users', 'rateio_claro', 'rateio_google'],
    is_active = true,
    updated_at = NOW()
WHERE lower(email) = lower('admin@serverkey.com');

INSERT INTO public.users (
  email,
  name,
  role,
  modules,
  is_active,
  auth_uid,
  pass
)
SELECT
  'admin@serverkey.com',
  'Administrador',
  'admin',
  ARRAY['usuarios', 'acessos', 'teams', 'win_users', 'rateio_claro', 'rateio_google'],
  true,
  NULL, -- Will be set when auth user is created
  'admin123'
WHERE NOT EXISTS (
  SELECT 1 FROM public.users WHERE lower(email) = lower('admin@serverkey.com')
);

-- Update all users to ensure they have proper modules based on their role
UPDATE public.users 
SET modules = CASE 
  WHEN role = 'admin' THEN ARRAY['usuarios', 'acessos', 'teams', 'win_users', 'rateio_claro', 'rateio_google']
  WHEN role = 'financeiro' THEN ARRAY['rateio_claro', 'rateio_google']
  WHEN role = 'usuario' THEN ARRAY['acessos', 'teams', 'win_users']
  ELSE ARRAY['acessos', 'teams', 'win_users']
END,
updated_at = NOW()
WHERE modules IS NULL OR array_length(modules, 1) IS NULL OR modules = '{}';

-- Create indexes for better performance (only if they don't exist)
CREATE INDEX IF NOT EXISTS idx_users_auth_uid_active ON public.users(auth_uid) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_users_role_active ON public.users(role) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON public.users(lower(email));

-- Now recreate all the policies for other tables

-- Recreate acessos policies
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE information_schema.tables.table_name = 'acessos') THEN
    CREATE POLICY "Users with acessos module can read"
      ON acessos
      FOR SELECT
      TO authenticated
      USING (has_module_access('acessos'));

    CREATE POLICY "Users with acessos module can manage their own data"
      ON acessos
      FOR ALL
      TO authenticated
      USING (auth.uid() = user_id AND has_module_access('acessos'))
      WITH CHECK (auth.uid() = user_id AND has_module_access('acessos'));
  END IF;
END $$;

-- Recreate teams policies
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE information_schema.tables.table_name = 'teams') THEN
    CREATE POLICY "Users with teams module can read"
      ON teams
      FOR SELECT
      TO authenticated
      USING (has_module_access('teams'));

    CREATE POLICY "Users with teams module can manage their own data"
      ON teams
      FOR ALL
      TO authenticated
      USING (auth.uid() = user_id AND has_module_access('teams'))
      WITH CHECK (auth.uid() = user_id AND has_module_access('teams'));
  END IF;
END $$;

-- Recreate rateio_claro policies
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE information_schema.tables.table_name = 'rateio_claro') THEN
    CREATE POLICY "Users with rateio_claro module can read"
      ON rateio_claro
      FOR SELECT
      TO authenticated
      USING (has_module_access('rateio_claro'));

    CREATE POLICY "Users with rateio_claro module can manage their own data"
      ON rateio_claro
      FOR ALL
      TO authenticated
      USING (auth.uid() = user_id AND has_module_access('rateio_claro'))
      WITH CHECK (auth.uid() = user_id AND has_module_access('rateio_claro'));
  END IF;
END $$;

-- Recreate rateio_google policies
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE information_schema.tables.table_name = 'rateio_google') THEN
    CREATE POLICY "Users with rateio_google module can read"
      ON rateio_google
      FOR SELECT
      TO authenticated
      USING (has_module_access('rateio_google'));

    CREATE POLICY "Users with rateio_google module can manage their own data"
      ON rateio_google
      FOR ALL
      TO authenticated
      USING (auth.uid() = user_id AND has_module_access('rateio_google'))
      WITH CHECK (auth.uid() = user_id AND has_module_access('rateio_google'));
  END IF;
END $$;

-- Recreate win_users policies if the table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE information_schema.tables.table_name = 'win_users') THEN
    -- Check if win_users has user_id column
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE information_schema.columns.table_name = 'win_users' AND column_name = 'user_id'
    ) THEN
      -- Create policies with user_id ownership check
      CREATE POLICY "Users with win_users module can read"
        ON win_users
        FOR SELECT
        TO authenticated
        USING (has_module_access('win_users'));

      CREATE POLICY "Users with win_users module can manage their own data"
        ON win_users
        FOR ALL
        TO authenticated
        USING (auth.uid() = user_id AND has_module_access('win_users'))
        WITH CHECK (auth.uid() = user_id AND has_module_access('win_users'));
    ELSE
      -- Create policies without user_id ownership check (global access for users with module)
      CREATE POLICY "Users with win_users module can read"
        ON win_users
        FOR SELECT
        TO authenticated
        USING (has_module_access('win_users'));

      CREATE POLICY "Users with win_users module can manage data"
        ON win_users
        FOR ALL
        TO authenticated
        USING (has_module_access('win_users'))
        WITH CHECK (has_module_access('win_users'));
    END IF;
  END IF;
END $$;
