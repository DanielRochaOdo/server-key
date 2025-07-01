/*
  # Fix acessos table policies and structure

  1. Policy Updates
    - Add policy for all authenticated users to read acessos
    - Keep existing policy for users to manage their own data
    - Ensure proper RLS configuration

  2. Performance
    - Verify indexes are in place
    - Add missing indexes if needed

  3. Data Integrity
    - Ensure foreign key constraints are properly set
*/

-- Add policy for all authenticated users to read acessos (if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'acessos' AND policyname = 'Todos podem ler'
  ) THEN
    CREATE POLICY "Todos podem ler"
      ON acessos
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- Ensure the user management policy exists and is correct
DO $$
BEGIN
  -- Drop existing policy if it exists to recreate with correct definition
  DROP POLICY IF EXISTS "Users can manage their own access data" ON acessos;
  
  -- Create the policy with correct definition
  CREATE POLICY "Users can manage their own access data"
    ON acessos
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
END $$;

-- Ensure foreign key constraint exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'acessos_user_id_fkey' 
    AND table_name = 'acessos'
  ) THEN
    ALTER TABLE acessos 
    ADD CONSTRAINT acessos_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Ensure indexes exist for better performance
CREATE INDEX IF NOT EXISTS idx_acessos_user_id ON acessos(user_id);
CREATE INDEX IF NOT EXISTS idx_acessos_created_at ON acessos(created_at);
CREATE INDEX IF NOT EXISTS idx_acessos_descricao ON acessos(descricao);