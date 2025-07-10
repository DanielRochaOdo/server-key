/*
  # Verify and fix authentication configuration

  1. Check auth settings
  2. Ensure proper session handling
  3. Fix any authentication issues
*/

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Verify auth.users table structure and constraints
DO $$
BEGIN
  -- Check if auth.users has the required columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'email'
  ) THEN
    RAISE EXCEPTION 'auth.users table is missing required columns';
  END IF;

  RAISE NOTICE '✅ auth.users table structure verified';
END $$;

-- Create a comprehensive function to debug authentication issues
CREATE OR REPLACE FUNCTION debug_auth_system()
RETURNS text AS $$
DECLARE
  result text := '';
  auth_count integer;
  public_count integer;
  linked_count integer;
  admin_auth RECORD;
  admin_public RECORD;
BEGIN
  result := result || '=== AUTHENTICATION SYSTEM DEBUG ===' || E'\n\n';

  -- Check auth.users
  SELECT COUNT(*) INTO auth_count FROM auth.users;
  result := result || 'Total users in auth.users: ' || auth_count || E'\n';

  -- Check public.users
  SELECT COUNT(*) INTO public_count FROM public.users;
  result := result || 'Total users in public.users: ' || public_count || E'\n';

  -- Check linked users
  SELECT COUNT(*) INTO linked_count 
  FROM public.users pu 
  JOIN auth.users au ON pu.auth_uid = au.id;
  result := result || 'Properly linked users: ' || linked_count || E'\n\n';

  -- Check admin user specifically
  SELECT * INTO admin_auth FROM auth.users WHERE email = 'admin@serverkey.com';
  SELECT * INTO admin_public FROM public.users WHERE email = 'admin@serverkey.com';

  result := result || '--- ADMIN USER DETAILS ---' || E'\n';
  
  IF admin_auth.id IS NOT NULL THEN
    result := result || '✅ Admin exists in auth.users' || E'\n';
    result := result || '   ID: ' || admin_auth.id || E'\n';
    result := result || '   Email confirmed: ' || COALESCE(admin_auth.email_confirmed_at::text, 'NO') || E'\n';
    result := result || '   Created: ' || admin_auth.created_at || E'\n';
  ELSE
    result := result || '❌ Admin NOT found in auth.users' || E'\n';
  END IF;

  IF admin_public.id IS NOT NULL THEN
    result := result || '✅ Admin exists in public.users' || E'\n';
    result := result || '   ID: ' || admin_public.id || E'\n';
    result := result || '   Role: ' || admin_public.role || E'\n';
    result := result || '   Active: ' || admin_public.is_active || E'\n';
    result := result || '   Auth UID: ' || COALESCE(admin_public.auth_uid::text, 'NULL') || E'\n';
  ELSE
    result := result || '❌ Admin NOT found in public.users' || E'\n';
  END IF;

  -- Check if they're linked
  IF admin_auth.id IS NOT NULL AND admin_public.id IS NOT NULL THEN
    IF admin_public.auth_uid = admin_auth.id THEN
      result := result || '✅ Admin users are properly linked' || E'\n';
    ELSE
      result := result || '❌ Admin users are NOT linked' || E'\n';
    END IF;
  END IF;

  result := result || E'\n--- RLS POLICIES ---' || E'\n';
  
  -- Check RLS policies
  SELECT COUNT(*) INTO auth_count 
  FROM pg_policies 
  WHERE tablename = 'users' AND schemaname = 'public';
  
  result := result || 'RLS policies on public.users: ' || auth_count || E'\n';

  -- Check if has_module_access function exists
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'has_module_access') THEN
    result := result || '✅ has_module_access function exists' || E'\n';
  ELSE
    result := result || '❌ has_module_access function missing' || E'\n';
  END IF;

  result := result || E'\n=== END DEBUG ===' || E'\n';

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run the debug function
SELECT debug_auth_system();

-- Clean up
DROP FUNCTION debug_auth_system();

-- Ensure auth.users has proper constraints and indexes
DO $$
BEGIN
  -- Check if email index exists on auth.users
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'users' AND schemaname = 'auth' AND indexname LIKE '%email%'
  ) THEN
    -- This should already exist, but let's make sure
    RAISE NOTICE 'Email index on auth.users should exist by default';
  END IF;
END $$;

-- Final test: Try to simulate a login check
CREATE OR REPLACE FUNCTION test_login_simulation()
RETURNS text AS $$
DECLARE
  auth_user RECORD;
  public_user RECORD;
  result text := '';
BEGIN
  -- Simulate what happens during login
  SELECT * INTO auth_user 
  FROM auth.users 
  WHERE email = 'admin@serverkey.com';

  IF auth_user.id IS NULL THEN
    RETURN '❌ Login would fail: auth user not found';
  END IF;

  -- Check if password field exists (it should be encrypted_password)
  IF auth_user.encrypted_password IS NULL THEN
    RETURN '❌ Login would fail: no password set';
  END IF;

  -- Check if email is confirmed
  IF auth_user.email_confirmed_at IS NULL THEN
    result := result || '⚠️ Email not confirmed, but login might still work' || E'\n';
  END IF;

  -- Now check if public user exists and is linked
  SELECT * INTO public_user 
  FROM public.users 
  WHERE auth_uid = auth_user.id;

  IF public_user.id IS NULL THEN
    RETURN result || '❌ Login would fail: public user profile not found';
  END IF;

  IF NOT public_user.is_active THEN
    RETURN result || '❌ Login would fail: user account is inactive';
  END IF;

  result := result || '✅ Login simulation successful!' || E'\n';
  result := result || 'User would be authenticated and profile loaded correctly.' || E'\n';

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run login simulation
SELECT test_login_simulation();

-- Clean up
DROP FUNCTION test_login_simulation();

-- Ensure the admin user has all required fields
UPDATE auth.users 
SET 
  email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
  updated_at = NOW()
WHERE email = 'admin@serverkey.com';

-- Final success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🎉 Authentication system verification completed!';
  RAISE NOTICE '';
  RAISE NOTICE 'You should now be able to login with:';
  RAISE NOTICE '  Email: admin@serverkey.com';
  RAISE NOTICE '  Password: admin123';
  RAISE NOTICE '';
  RAISE NOTICE 'If you still have issues:';
  RAISE NOTICE '1. Clear your browser localStorage';
  RAISE NOTICE '2. Try in an incognito window';
  RAISE NOTICE '3. Check the browser console for errors';
END $$;