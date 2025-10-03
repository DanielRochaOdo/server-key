/*
  # Fix RLS policies for rateio_claro to allow admin editing

  1. Changes
    - Drop existing policies for rateio_claro
    - Create new policies that allow:
      - Admins to have full access (INSERT, UPDATE, DELETE) to all records
      - Regular users with module access to have full access to their own records
      - All authenticated users with module access to view records (SELECT)
    
  2. Security
    - Admins can manage all rateio_claro records
    - Users can only manage their own records
    - All changes require proper authentication and module access
*/

-- Drop existing policies
DROP POLICY IF EXISTS "rateio_claro_module_manage_own" ON rateio_claro;
DROP POLICY IF EXISTS "rateio_claro_module_read" ON rateio_claro;

-- Allow admins to select all records
CREATE POLICY "Admin can view all rateio_claro"
  ON rateio_claro
  FOR SELECT
  TO authenticated
  USING (is_admin());

-- Allow admins to insert records
CREATE POLICY "Admin can insert rateio_claro"
  ON rateio_claro
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- Allow admins to update all records
CREATE POLICY "Admin can update all rateio_claro"
  ON rateio_claro
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Allow admins to delete all records
CREATE POLICY "Admin can delete all rateio_claro"
  ON rateio_claro
  FOR DELETE
  TO authenticated
  USING (is_admin());

-- Allow users with module access to view records
CREATE POLICY "Users with module access can view rateio_claro"
  ON rateio_claro
  FOR SELECT
  TO authenticated
  USING (has_module_access('rateio_claro'));

-- Allow users with module access to insert their own records
CREATE POLICY "Users with module access can insert own rateio_claro"
  ON rateio_claro
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_module_access('rateio_claro') 
    AND auth.uid() = user_id
  );

-- Allow users with module access to update their own records
CREATE POLICY "Users with module access can update own rateio_claro"
  ON rateio_claro
  FOR UPDATE
  TO authenticated
  USING (
    has_module_access('rateio_claro') 
    AND auth.uid() = user_id
  )
  WITH CHECK (
    has_module_access('rateio_claro') 
    AND auth.uid() = user_id
  );

-- Allow users with module access to delete their own records
CREATE POLICY "Users with module access can delete own rateio_claro"
  ON rateio_claro
  FOR DELETE
  TO authenticated
  USING (
    has_module_access('rateio_claro') 
    AND auth.uid() = user_id
  );