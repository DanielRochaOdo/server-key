/*
  # Complete Authentication System Rebuild
  
  1. Clean up existing auth data and policies
  2. Create proper user management system with roles
  3. Set up correct RLS policies
  4. Create admin user properly
  5. Ensure proper auth flow
*/

-- Ensure pgcrypto is available for gen_random_uuid / gen_salt / crypt
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
SET search_path = public, extensions;

-- First, let's clean up everything and start fresh
DO $$
DECLARE
    pol RECORD;
    tbl_name text;
BEGIN
    -- Drop all existing policies on all tables
    FOR tbl_name IN SELECT unnest(ARRAY['users', 'acessos', 'teams', 'rateio_claro', 'rateio_google', 'win_users']) LOOP
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = tbl_name AND table_schema = 'public') THEN
            FOR pol IN 
                SELECT policyname 
                FROM pg_policies 
                WHERE tablename = tbl_name AND schemaname = 'public'
            LOOP
                EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl_name);
            END LOOP;
        END IF;
    END LOOP;
END $$;

-- Drop all existing functions
DROP FUNCTION IF EXISTS has_module_access(text) CASCADE;
DROP FUNCTION IF EXISTS is_admin() CASCADE;
DROP FUNCTION IF EXISTS get_user_role(uuid) CASCADE;
DROP FUNCTION IF EXISTS is_user_admin(uuid) CASCADE;
DROP FUNCTION IF EXISTS handle_new_auth_user() CASCADE;
DROP FUNCTION IF EXISTS sync_auth_user_to_public_users() CASCADE;
DROP FUNCTION IF EXISTS create_user_profile(uuid, text, text, text, text[], boolean, uuid, text) CASCADE;

-- Drop existing triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Clean up existing admin user data to start fresh
DELETE FROM public.users WHERE lower(email) = lower('admin@serverkey.com');
DELETE FROM auth.users WHERE lower(email) = lower('admin@serverkey.com');

-- Ensure users table has correct structure
DO $$
BEGIN
  -- Ensure all required columns exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'auth_uid') THEN
    ALTER TABLE public.users ADD COLUMN auth_uid uuid UNIQUE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'pass') THEN
    ALTER TABLE public.users ADD COLUMN pass text NOT NULL DEFAULT '';
  END IF;
END $$;

-- Create indexes for better performance
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth_uid_unique ON public.users(auth_uid);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON public.users(is_active);

-- Enable RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create the core authentication functions
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

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE auth_uid = auth.uid() 
    AND role = 'admin' 
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION has_module_access TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION is_admin TO authenticated, anon, service_role;

-- Create comprehensive RLS policies for users table

-- 1. Service role can do everything
CREATE POLICY "service_role_full_access"
  ON public.users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2. Allow public/anon insert (needed for Edge Functions)
CREATE POLICY "public_can_insert_users"
  ON public.users
  FOR INSERT
  TO public
  WITH CHECK (true);

-- 3. Users can read their own profile
CREATE POLICY "users_can_read_themselves"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth_uid = auth.uid());

-- 4. Users can update their own profile (limited fields)
CREATE POLICY "users_can_update_own_profile"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth_uid = auth.uid())
  WITH CHECK (auth_uid = auth.uid());

-- 5. Admins can read all users
CREATE POLICY "admins_can_read_all_users"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (is_admin());

-- 6. Admins can update all users
CREATE POLICY "admins_can_update_all_users"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Create RLS policies for other tables

-- Acessos table policies
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'acessos') THEN
    CREATE POLICY "acessos_module_read"
      ON acessos
      FOR SELECT
      TO authenticated
      USING (has_module_access('acessos'));

    CREATE POLICY "acessos_module_manage_own"
      ON acessos
      FOR ALL
      TO authenticated
      USING (auth.uid() = user_id AND has_module_access('acessos'))
      WITH CHECK (auth.uid() = user_id AND has_module_access('acessos'));
  END IF;
END $$;

-- Teams table policies
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'teams') THEN
    CREATE POLICY "teams_module_read"
      ON teams
      FOR SELECT
      TO authenticated
      USING (has_module_access('teams'));

    CREATE POLICY "teams_module_manage_own"
      ON teams
      FOR ALL
      TO authenticated
      USING (auth.uid() = user_id AND has_module_access('teams'))
      WITH CHECK (auth.uid() = user_id AND has_module_access('teams'));
  END IF;
END $$;

-- Rateio Claro table policies
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'rateio_claro') THEN
    CREATE POLICY "rateio_claro_module_read"
      ON rateio_claro
      FOR SELECT
      TO authenticated
      USING (has_module_access('rateio_claro'));

    CREATE POLICY "rateio_claro_module_manage_own"
      ON rateio_claro
      FOR ALL
      TO authenticated
      USING (auth.uid() = user_id AND has_module_access('rateio_claro'))
      WITH CHECK (auth.uid() = user_id AND has_module_access('rateio_claro'));
  END IF;
END $$;

-- Rateio Google table policies
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'rateio_google') THEN
    CREATE POLICY "rateio_google_module_read"
      ON rateio_google
      FOR SELECT
      TO authenticated
      USING (has_module_access('rateio_google'));

    CREATE POLICY "rateio_google_module_manage_own"
      ON rateio_google
      FOR ALL
      TO authenticated
      USING (auth.uid() = user_id AND has_module_access('rateio_google'))
      WITH CHECK (auth.uid() = user_id AND has_module_access('rateio_google'));
  END IF;
END $$;

-- Win Users table policies
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'win_users') THEN
    -- Check if win_users has user_id column
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'win_users' AND column_name = 'user_id'
    ) THEN
      CREATE POLICY "win_users_module_read"
        ON win_users
        FOR SELECT
        TO authenticated
        USING (has_module_access('win_users'));

      CREATE POLICY "win_users_module_manage_own"
        ON win_users
        FOR ALL
        TO authenticated
        USING (auth.uid() = user_id AND has_module_access('win_users'))
        WITH CHECK (auth.uid() = user_id AND has_module_access('win_users'));
    ELSE
      -- Global access for users with module (no user_id column)
      CREATE POLICY "win_users_module_read"
        ON win_users
        FOR SELECT
        TO authenticated
        USING (has_module_access('win_users'));

      CREATE POLICY "win_users_module_manage"
        ON win_users
        FOR ALL
        TO authenticated
        USING (has_module_access('win_users'))
        WITH CHECK (has_module_access('win_users'));
    END IF;
  END IF;
END $$;

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
    role = EXCLUDED.role,
    modules = EXCLUDED.modules,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new auth users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- Now create the admin user properly in both tables
DO $$
DECLARE
  admin_auth_id uuid;
BEGIN
  -- Generate a consistent UUID for admin
  admin_auth_id := gen_random_uuid();

  -- First create in auth.users
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
        $1,
        'authenticated',
        'authenticated',
        'admin@serverkey.com',
        crypt('admin123', gen_salt('bf')),
        NOW(),
        '{"name": "Administrador", "role": "admin", "password": "admin123"}',
        NOW(),
        NOW(),
        '',
        '',
        '',
        ''
      );
    $sql$ USING admin_auth_id;

    -- The trigger will automatically create the public.users record
    -- But let's ensure it's correct
    UPDATE public.users 
    SET 
      role = 'admin',
      modules = ARRAY['usuarios', 'acessos', 'teams', 'win_users', 'rateio_claro', 'rateio_google'],
      is_active = true,
      pass = 'admin123'
    WHERE auth_uid = admin_auth_id;

    RAISE NOTICE '? Admin user created successfully with ID: %', admin_auth_id;
  ELSE
    RAISE NOTICE 'Skipping auth.users admin insert: pgcrypto (gen_salt) not available.';
    UPDATE public.users
    SET role = 'admin',
        modules = ARRAY['usuarios', 'acessos', 'teams', 'win_users', 'rateio_claro', 'rateio_google'],
        is_active = true,
        pass = 'admin123'
    WHERE lower(email) = lower('admin@serverkey.com');

    IF NOT FOUND THEN
      INSERT INTO public.users (email, name, role, modules, is_active, pass)
      VALUES (
        'admin@serverkey.com',
        'Administrador',
        'admin',
        ARRAY['usuarios', 'acessos', 'teams', 'win_users', 'rateio_claro', 'rateio_google'],
        true,
        'admin123'
      );
    END IF;
  END IF;

END $$;

-- Verify the setup
DO $$
DECLARE
  auth_count integer;
  public_count integer;
  linked_count integer;
  policy_count integer;
BEGIN
  -- Count users
  SELECT COUNT(*) INTO auth_count FROM auth.users WHERE email = 'admin@serverkey.com';
  SELECT COUNT(*) INTO public_count FROM public.users WHERE email = 'admin@serverkey.com';
  SELECT COUNT(*) INTO linked_count 
  FROM public.users pu 
  JOIN auth.users au ON pu.auth_uid = au.id 
  WHERE pu.email = 'admin@serverkey.com';

  -- Count policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'users' AND schemaname = 'public';

  RAISE NOTICE '';
  RAISE NOTICE '=== AUTHENTICATION SYSTEM SETUP COMPLETE ===';
  RAISE NOTICE '';
  RAISE NOTICE 'Admin users in auth.users: %', auth_count;
  RAISE NOTICE 'Admin users in public.users: %', public_count;
  RAISE NOTICE 'Properly linked admin users: %', linked_count;
  RAISE NOTICE 'RLS policies on users table: %', policy_count;
  RAISE NOTICE '';

  IF auth_count = 1 AND public_count = 1 AND linked_count = 1 AND policy_count >= 5 THEN
    RAISE NOTICE '🎉 SUCCESS: Authentication system is properly configured!';
    RAISE NOTICE '';
    RAISE NOTICE 'You can now login with:';
    RAISE NOTICE '  Email: admin@serverkey.com';
    RAISE NOTICE '  Password: admin123';
  ELSE
    RAISE WARNING '❌ SETUP INCOMPLETE: Some components are missing';
  END IF;
  
  RAISE NOTICE '';
END $$;
