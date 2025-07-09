/*
  # Fix users table policies and add database improvements

  1. Database Improvements
    - Add better constraints and indexes
    - Improve RLS policies for better security
    - Add function to handle user creation atomically

  2. Security Updates
    - Update RLS policies to be more restrictive
    - Add proper constraints to prevent duplicates
    - Improve error handling

  3. Performance
    - Add indexes for better query performance
    - Optimize policies for faster execution
*/

-- Add constraint to ensure auth_uid is unique when not null
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_auth_uid_unique'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_auth_uid_unique UNIQUE (auth_uid);
  END IF;
END $$;

-- Add constraint to ensure email is unique
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_email_unique'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);
  END IF;
END $$;

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Allow authenticated users to insert" ON users;
DROP POLICY IF EXISTS "Allow users to read their own record" ON users;
DROP POLICY IF EXISTS "Allow users to update their own record" ON users;
DROP POLICY IF EXISTS "Can read own profile" ON users;
DROP POLICY IF EXISTS "users_can_select_themselves" ON users;

-- Create new, more secure policies

-- Allow service role to insert users (for Edge Functions)
CREATE POLICY "service_role_can_insert_users"
  ON users
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Allow authenticated users to insert users (for Edge Functions via anon key)
CREATE POLICY "authenticated_can_insert_users"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow users to read their own record by auth_uid
CREATE POLICY "users_can_read_own_profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = auth_uid);

-- Allow users to update their own record
CREATE POLICY "users_can_update_own_profile"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = auth_uid)
  WITH CHECK (auth.uid() = auth_uid);

-- Allow admins to read all users
CREATE POLICY "admins_can_read_all_users"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users admin_user
      WHERE admin_user.auth_uid = auth.uid()
      AND admin_user.role = 'admin'
      AND admin_user.is_active = true
    )
  );

-- Allow admins to update all users
CREATE POLICY "admins_can_update_all_users"
  ON users
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users admin_user
      WHERE admin_user.auth_uid = auth.uid()
      AND admin_user.role = 'admin'
      AND admin_user.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users admin_user
      WHERE admin_user.auth_uid = auth.uid()
      AND admin_user.role = 'admin'
      AND admin_user.is_active = true
    )
  );

-- Create function to handle user creation with proper error handling
CREATE OR REPLACE FUNCTION create_user_profile(
  p_id uuid,
  p_email text,
  p_name text,
  p_role text,
  p_modules text[],
  p_is_active boolean,
  p_auth_uid uuid,
  p_pass text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result_user users%ROWTYPE;
BEGIN
  -- Check if user already exists
  IF EXISTS (SELECT 1 FROM users WHERE email = p_email OR auth_uid = p_auth_uid) THEN
    RETURN json_build_object('error', 'User already exists');
  END IF;

  -- Insert user
  INSERT INTO users (id, email, name, role, modules, is_active, auth_uid, pass)
  VALUES (p_id, p_email, p_name, p_role, p_modules, p_is_active, p_auth_uid, p_pass)
  RETURNING * INTO result_user;

  -- Return success
  RETURN json_build_object(
    'success', true,
    'user', json_build_object(
      'id', result_user.id,
      'email', result_user.email,
      'name', result_user.name,
      'role', result_user.role,
      'modules', result_user.modules,
      'is_active', result_user.is_active
    )
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object('error', 'User already exists');
  WHEN OTHERS THEN
    RETURN json_build_object('error', SQLERRM);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_user_profile TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_profile TO service_role;

-- Create indexes for better performance if they don't exist
CREATE INDEX IF NOT EXISTS idx_users_auth_uid_active ON users(auth_uid) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_users_role_active ON users(role) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users(lower(email));

-- Update the is_admin function to be more efficient
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE auth_uid = auth.uid() 
    AND role = 'admin' 
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create function to check user module access
CREATE OR REPLACE FUNCTION has_module_access(module_name text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE auth_uid = auth.uid() 
    AND module_name = ANY(modules)
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_admin TO authenticated;
GRANT EXECUTE ON FUNCTION has_module_access TO authenticated;

-- Update module table policies to use the new function

-- Update acessos policies
DROP POLICY IF EXISTS "Users with acessos module can read" ON acessos;
DROP POLICY IF EXISTS "Users with acessos module can manage their own data" ON acessos;

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

-- Update teams policies
DROP POLICY IF EXISTS "Users with teams module can read" ON teams;
DROP POLICY IF EXISTS "Users with teams module can manage their own data" ON teams;

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

-- Update rateio_claro policies
DROP POLICY IF EXISTS "Users with rateio_claro module can read" ON rateio_claro;
DROP POLICY IF EXISTS "Users with rateio_claro module can manage their own data" ON rateio_claro;

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

-- Update rateio_google policies
DROP POLICY IF EXISTS "Users with rateio_google module can read" ON rateio_google;
DROP POLICY IF EXISTS "Users with rateio_google module can manage their own data" ON rateio_google;

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

-- Add win_users table policies if the table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'win_users') THEN
    -- Drop existing policies
    DROP POLICY IF EXISTS "Users with win_users module can read" ON win_users;
    DROP POLICY IF EXISTS "Users with win_users module can manage their own data" ON win_users;

    -- Create new policies
    EXECUTE 'CREATE POLICY "Users with win_users module can read"
      ON win_users
      FOR SELECT
      TO authenticated
      USING (has_module_access(''win_users''))';

    EXECUTE 'CREATE POLICY "Users with win_users module can manage their own data"
      ON win_users
      FOR ALL
      TO authenticated
      USING (auth.uid() = user_id AND has_module_access(''win_users''))
      WITH CHECK (auth.uid() = user_id AND has_module_access(''win_users''))';
  END IF;
END $$;