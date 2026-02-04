-- Fix user creation to ensure proper sync between auth.users and public.users

-- Drop existing trigger and function to recreate them
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_auth_user() CASCADE;

-- Create improved function to handle new auth user creation
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role text := 'usuario';
  user_modules text[] := ARRAY['acessos', 'teams', 'win_users'];
  user_name text;
  user_password text := '';
BEGIN
  -- Extract data from user metadata
  IF NEW.raw_user_meta_data IS NOT NULL THEN
    -- Extract role
    IF NEW.raw_user_meta_data ? 'role' THEN
      user_role := NEW.raw_user_meta_data->>'role';
    END IF;
    
    -- Extract name
    IF NEW.raw_user_meta_data ? 'name' THEN
      user_name := NEW.raw_user_meta_data->>'name';
    END IF;
    
    -- Extract password
    IF NEW.raw_user_meta_data ? 'password' THEN
      user_password := NEW.raw_user_meta_data->>'password';
    END IF;
  END IF;

  -- Default name if not provided
  IF user_name IS NULL OR user_name = '' THEN
    user_name := split_part(NEW.email, '@', 1);
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

  -- Log the trigger execution
  RAISE NOTICE 'Creating public user for auth user: % with role: % and modules: %', NEW.email, user_role, user_modules;

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

  RAISE NOTICE 'Public user created/updated successfully for: %', NEW.email;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in handle_new_auth_user trigger for %: %', NEW.email, SQLERRM;
    RETURN NEW; -- Don't fail the auth user creation if public user creation fails
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new auth users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- Create function to manually sync existing auth users
CREATE OR REPLACE FUNCTION sync_existing_auth_users()
RETURNS text AS $$
DECLARE
  auth_user RECORD;
  user_role text;
  user_modules text[];
  user_name text;
  user_password text;
  sync_count integer := 0;
  result_text text := '';
BEGIN
  result_text := 'Starting sync of existing auth users...' || E'\n';

  -- Loop through all auth users that don't have a corresponding public user
  FOR auth_user IN 
    SELECT au.id, au.email, au.raw_user_meta_data, au.created_at
    FROM auth.users au
    LEFT JOIN public.users pu ON au.id = pu.auth_uid
    WHERE pu.auth_uid IS NULL
  LOOP
    -- Extract data from metadata
    user_role := 'usuario';
    user_name := split_part(auth_user.email, '@', 1);
    user_password := '';
    
    IF auth_user.raw_user_meta_data IS NOT NULL THEN
      user_role := COALESCE(auth_user.raw_user_meta_data->>'role', 'usuario');
      user_name := COALESCE(auth_user.raw_user_meta_data->>'name', user_name);
      user_password := COALESCE(auth_user.raw_user_meta_data->>'password', '');
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
      auth_user.email,
      user_name,
      user_role,
      user_modules,
      true,
      auth_user.id,
      user_password,
      auth_user.created_at,
      NOW()
    );

    sync_count := sync_count + 1;
    result_text := result_text || 'Synced user: ' || auth_user.email || ' (role: ' || user_role || ')' || E'\n';
  END LOOP;

  result_text := result_text || 'Sync completed. Total users synced: ' || sync_count;
  
  RETURN result_text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run the sync function
SELECT sync_existing_auth_users();

-- Clean up the sync function
DROP FUNCTION sync_existing_auth_users();

-- Verify the admin user exists and is properly linked
DO $$
DECLARE
  auth_admin RECORD;
  public_admin RECORD;
  admin_auth_id uuid;
BEGIN
  -- Check if admin exists in auth.users
  SELECT * INTO auth_admin FROM auth.users WHERE email = 'admin@serverkey.com';
  
  -- Check if admin exists in public.users
  SELECT * INTO public_admin FROM public.users WHERE email = 'admin@serverkey.com';
  
  IF auth_admin.id IS NULL THEN
    RAISE NOTICE 'Creating admin user in auth.users...';
    
    -- Generate UUID for admin
    admin_auth_id := gen_random_uuid();
    
    -- Create admin in auth.users
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
    ELSE
      RAISE NOTICE 'Skipping auth.users admin insert: pgcrypto (gen_salt) not available.';
    END IF;
    
    RAISE NOTICE 'Admin user created in auth.users with ID: %', admin_auth_id;
  ELSE
    admin_auth_id := auth_admin.id;
    RAISE NOTICE 'Admin user already exists in auth.users with ID: %', admin_auth_id;
  END IF;
  
  -- Ensure admin exists in public.users and is properly linked
  IF public_admin.id IS NULL THEN
    RAISE NOTICE 'Creating admin user in public.users...';
    
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
      'admin@serverkey.com',
      'Administrador',
      'admin',
      ARRAY['usuarios', 'acessos', 'teams', 'win_users', 'rateio_claro', 'rateio_google'],
      true,
      admin_auth_id,
      'admin123',
      NOW(),
      NOW()
    );
    
    RAISE NOTICE 'Admin user created in public.users';
  ELSE
    -- Update existing admin to ensure proper linking and data
    UPDATE public.users 
    SET 
      auth_uid = admin_auth_id,
      role = 'admin',
      modules = ARRAY['usuarios', 'acessos', 'teams', 'win_users', 'rateio_claro', 'rateio_google'],
      is_active = true,
      pass = 'admin123',
      updated_at = NOW()
    WHERE email = 'admin@serverkey.com';
    
    RAISE NOTICE 'Admin user updated in public.users';
  END IF;
END $$;

-- Final verification
DO $$
DECLARE
  auth_count integer;
  public_count integer;
  linked_count integer;
  admin_linked boolean;
BEGIN
  -- Count total users
  SELECT COUNT(*) INTO auth_count FROM auth.users;
  SELECT COUNT(*) INTO public_count FROM public.users;
  
  -- Count properly linked users
  SELECT COUNT(*) INTO linked_count 
  FROM public.users pu 
  JOIN auth.users au ON pu.auth_uid = au.id;
  
  -- Check if admin is properly linked
  SELECT EXISTS (
    SELECT 1 
    FROM public.users pu 
    JOIN auth.users au ON pu.auth_uid = au.id 
    WHERE pu.email = 'admin@serverkey.com' 
    AND au.email = 'admin@serverkey.com'
    AND pu.role = 'admin'
    AND pu.is_active = true
  ) INTO admin_linked;

  RAISE NOTICE '';
  RAISE NOTICE '=== USER SYNC VERIFICATION ===';
  RAISE NOTICE 'Total auth.users: %', auth_count;
  RAISE NOTICE 'Total public.users: %', public_count;
  RAISE NOTICE 'Properly linked users: %', linked_count;
  RAISE NOTICE 'Admin properly linked: %', CASE WHEN admin_linked THEN 'YES' ELSE 'NO' END;
  RAISE NOTICE '';
  
  IF linked_count = auth_count AND admin_linked THEN
    RAISE NOTICE '🎉 SUCCESS: All users are properly synced!';
    RAISE NOTICE '';
    RAISE NOTICE 'You can now login with:';
    RAISE NOTICE '  Email: admin@serverkey.com';
    RAISE NOTICE '  Password: admin123';
  ELSE
    RAISE WARNING '❌ SYNC INCOMPLETE: Some users are not properly linked';
  END IF;
  
  RAISE NOTICE '';
END $$;
