/*
  # Fix RLS policies for users table and modules

  1. Users Table Policies
    - Allow public insert (for Edge Functions)
    - Allow users to read their own data
    - Allow users to update their own data

  2. Module-based Policies
    - Update all module tables to use correct user lookup
    - Maintain security based on user modules and active status

  3. Security
    - Maintain RLS protection
    - Allow Edge Functions to work properly
    - Preserve module-based access control
*/

-- Drop existing problematic policies on users table
DROP POLICY IF EXISTS "Admin can insert users" ON users;
DROP POLICY IF EXISTS "Users can read their data or admin can read all" ON users;
DROP POLICY IF EXISTS "Users can update their data or admin can update all" ON users;
DROP POLICY IF EXISTS "Allow authenticated users to insert" ON users;
DROP POLICY IF EXISTS "Allow users to read their own record" ON users;
DROP POLICY IF EXISTS "Allow users to update their own record" ON users;
DROP POLICY IF EXISTS "Can read own profile" ON users;
DROP POLICY IF EXISTS "users_can_select_themselves" ON users;

-- Create new policies for users table that work with Edge Functions

-- Allow public insert (needed for Edge Functions to create users)
CREATE POLICY "Allow authenticated users to insert"
  ON users
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Allow users to read their own record by id
CREATE POLICY "Allow users to read their own record"
  ON users
  FOR SELECT
  TO public
  USING (auth.uid() = id);

-- Allow users to update their own record
CREATE POLICY "Allow users to update their own record"
  ON users
  FOR UPDATE
  TO public
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow reading own profile by auth_uid
CREATE POLICY "Can read own profile"
  ON users
  FOR SELECT
  TO public
  USING (auth.uid() = auth_uid);

-- Allow users to select themselves by auth_uid
CREATE POLICY "users_can_select_themselves"
  ON users
  FOR SELECT
  TO public
  USING (auth_uid = auth.uid());

-- Update acessos policies
DROP POLICY IF EXISTS "Users with acessos module can read" ON acessos;
DROP POLICY IF EXISTS "Users with acessos module can manage their own data" ON acessos;

CREATE POLICY "Users with acessos module can read"
  ON acessos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.auth_uid = auth.uid() 
      AND 'acessos' = ANY(users.modules)
      AND users.is_active = true
    )
  );

CREATE POLICY "Users with acessos module can manage their own data"
  ON acessos
  FOR ALL
  TO authenticated
  USING (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.auth_uid = auth.uid() 
      AND 'acessos' = ANY(users.modules)
      AND users.is_active = true
    )
  )
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.auth_uid = auth.uid() 
      AND 'acessos' = ANY(users.modules)
      AND users.is_active = true
    )
  );

-- Update teams policies
DROP POLICY IF EXISTS "Users with teams module can read" ON teams;
DROP POLICY IF EXISTS "Users with teams module can manage their own data" ON teams;

CREATE POLICY "Users with teams module can read"
  ON teams
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.auth_uid = auth.uid() 
      AND 'teams' = ANY(users.modules)
      AND users.is_active = true
    )
  );

CREATE POLICY "Users with teams module can manage their own data"
  ON teams
  FOR ALL
  TO authenticated
  USING (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.auth_uid = auth.uid() 
      AND 'teams' = ANY(users.modules)
      AND users.is_active = true
    )
  )
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.auth_uid = auth.uid() 
      AND 'teams' = ANY(users.modules)
      AND users.is_active = true
    )
  );

-- Update rateio_claro policies
DROP POLICY IF EXISTS "Users with rateio_claro module can read" ON rateio_claro;
DROP POLICY IF EXISTS "Users with rateio_claro module can manage their own data" ON rateio_claro;

CREATE POLICY "Users with rateio_claro module can read"
  ON rateio_claro
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.auth_uid = auth.uid() 
      AND 'rateio_claro' = ANY(users.modules)
      AND users.is_active = true
    )
  );

CREATE POLICY "Users with rateio_claro module can manage their own data"
  ON rateio_claro
  FOR ALL
  TO authenticated
  USING (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.auth_uid = auth.uid() 
      AND 'rateio_claro' = ANY(users.modules)
      AND users.is_active = true
    )
  )
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.auth_uid = auth.uid() 
      AND 'rateio_claro' = ANY(users.modules)
      AND users.is_active = true
    )
  );

-- Update rateio_google policies
DROP POLICY IF EXISTS "Users with rateio_google module can read" ON rateio_google;
DROP POLICY IF EXISTS "Users with rateio_google module can manage their own data" ON rateio_google;

CREATE POLICY "Users with rateio_google module can read"
  ON rateio_google
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.auth_uid = auth.uid() 
      AND 'rateio_google' = ANY(users.modules)
      AND users.is_active = true
    )
  );

CREATE POLICY "Users with rateio_google module can manage their own data"
  ON rateio_google
  FOR ALL
  TO authenticated
  USING (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.auth_uid = auth.uid() 
      AND 'rateio_google' = ANY(users.modules)
      AND users.is_active = true
    )
  )
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.auth_uid = auth.uid() 
      AND 'rateio_google' = ANY(users.modules)
      AND users.is_active = true
    )
  );