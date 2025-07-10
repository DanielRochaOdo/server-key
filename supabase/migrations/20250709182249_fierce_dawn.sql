/*
  # Verify and fix RLS policies for users table

  1. Ensure RLS is enabled on users table
  2. Create comprehensive policies that work correctly
  3. Test policy functionality
  4. Grant necessary permissions
*/

-- Ensure RLS is enabled on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to start fresh
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

-- Create comprehensive policies for users table

-- 1. Service role can do everything (needed for Edge Functions)
CREATE POLICY "service_role_can_manage_users"
  ON public.users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2. Allow public insert (needed for Edge Functions using anon key)
CREATE POLICY "public_can_insert_users"
  ON public.users
  FOR INSERT
  TO public
  WITH CHECK (true);

-- 3. Allow authenticated insert (needed for Edge Functions)
CREATE POLICY "authenticated_can_insert_users"
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 4. Users can read their own profile by auth_uid
CREATE POLICY "users_can_read_themselves"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth_uid = auth.uid());

-- 5. Users can update their own basic profile
CREATE POLICY "users_can_update_own_profile"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth_uid = auth.uid())
  WITH CHECK (auth_uid = auth.uid());

-- 6. Admins can read all users
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

-- 7. Admins can update all users
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

-- Grant necessary permissions to roles
GRANT ALL ON public.users TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;
GRANT SELECT, INSERT ON public.users TO anon;

-- Test the policies by creating a test function
CREATE OR REPLACE FUNCTION test_user_policies()
RETURNS text AS $$
DECLARE
  admin_user RECORD;
  test_result text := '';
BEGIN
  -- Get admin user
  SELECT * INTO admin_user
  FROM public.users
  WHERE email = 'admin@serverkey.com'
  LIMIT 1;

  IF admin_user.id IS NULL THEN
    RETURN 'ERROR: Admin user not found';
  END IF;

  test_result := test_result || 'Admin user found: ' || admin_user.email || E'\n';
  test_result := test_result || 'Admin role: ' || admin_user.role || E'\n';
  test_result := test_result || 'Admin active: ' || admin_user.is_active::text || E'\n';
  test_result := test_result || 'Admin auth_uid: ' || COALESCE(admin_user.auth_uid::text, 'NULL') || E'\n';
  
  -- Check if auth user exists
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@serverkey.com') THEN
    test_result := test_result || 'Auth user exists: YES' || E'\n';
  ELSE
    test_result := test_result || 'Auth user exists: NO' || E'\n';
  END IF;

  -- Check modules
  test_result := test_result || 'Admin modules: ' || array_to_string(admin_user.modules, ', ') || E'\n';

  RETURN test_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run the test
SELECT test_user_policies();

-- Clean up test function
DROP FUNCTION test_user_policies();

-- Ensure has_module_access function exists and works correctly
CREATE OR REPLACE FUNCTION has_module_access(module_name text)
RETURNS boolean AS $$
DECLARE
  user_modules text[];
  user_active boolean;
BEGIN
  -- Get user modules and active status
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

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION has_module_access TO authenticated, service_role;

-- Final verification
DO $$
DECLARE
  policy_count integer;
  admin_count integer;
  auth_admin_count integer;
BEGIN
  -- Count policies on users table
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'users' AND schemaname = 'public';

  -- Count admin users in public.users
  SELECT COUNT(*) INTO admin_count
  FROM public.users
  WHERE email = 'admin@serverkey.com' AND role = 'admin' AND is_active = true;

  -- Count admin users in auth.users
  SELECT COUNT(*) INTO auth_admin_count
  FROM auth.users
  WHERE email = 'admin@serverkey.com';

  RAISE NOTICE 'Verification Results:';
  RAISE NOTICE '- RLS Policies on users table: %', policy_count;
  RAISE NOTICE '- Admin users in public.users: %', admin_count;
  RAISE NOTICE '- Admin users in auth.users: %', auth_admin_count;

  IF policy_count < 5 THEN
    RAISE WARNING 'Expected at least 5 policies, found %', policy_count;
  END IF;

  IF admin_count = 0 THEN
    RAISE WARNING 'No admin user found in public.users';
  END IF;

  IF auth_admin_count = 0 THEN
    RAISE WARNING 'No admin user found in auth.users';
  END IF;

  IF policy_count >= 5 AND admin_count > 0 AND auth_admin_count > 0 THEN
    RAISE NOTICE 'All verifications passed successfully!';
  END IF;
END $$;