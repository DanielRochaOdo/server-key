/*
  # Fix Teams table policies and permissions

  1. Changes
    - Update teams table policies to allow proper CRUD operations
    - Ensure users can create, read, update, and delete their own teams
    - Fix any permission issues preventing manual creation

  2. Security
    - Maintain RLS protection
    - Users can only manage their own data
    - Admins can read all data but users manage their own
*/

-- Drop existing policies
DROP POLICY IF EXISTS "teams_module_manage_own" ON teams;
DROP POLICY IF EXISTS "teams_module_read" ON teams;

-- Create new comprehensive policies
CREATE POLICY "teams_users_manage_own"
  ON teams
  FOR ALL
  TO authenticated
  USING (
    (auth.uid() = user_id AND has_module_access('teams'::text))
    OR 
    is_admin()
  )
  WITH CHECK (
    (auth.uid() = user_id AND has_module_access('teams'::text))
    OR 
    is_admin()
  );

-- Ensure user_id column exists and has proper foreign key
DO $$
BEGIN
  -- Add user_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'teams' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE teams ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  
  -- Add index for performance
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'teams' AND indexname = 'idx_teams_user_id'
  ) THEN
    CREATE INDEX idx_teams_user_id ON teams(user_id);
  END IF;
END $$;