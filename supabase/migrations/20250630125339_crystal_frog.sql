/*
  # Update teams table structure

  1. Table Updates
    - Add `user_id` column to existing `teams` table
    - Add `observacao` column to existing `teams` table  
    - Add `updated_at` column to existing `teams` table
    - Update existing records to have proper timestamps

  2. Security
    - Enable RLS on `teams` table
    - Add policy for authenticated users to manage their own data

  3. Performance
    - Add indexes for better query performance

  4. Automation
    - Add trigger to automatically update `updated_at` timestamp
*/

-- Add missing columns to existing teams table
DO $$
BEGIN
  -- Add user_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'teams' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE teams ADD COLUMN user_id uuid;
  END IF;

  -- Add observacao column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'teams' AND column_name = 'observacao'
  ) THEN
    ALTER TABLE teams ADD COLUMN observacao text;
  END IF;

  -- Add updated_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'teams' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE teams ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Update existing records to have updated_at timestamp
UPDATE teams SET updated_at = created_at WHERE updated_at IS NULL;

-- Enable Row Level Security
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to manage their own data
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'teams' AND policyname = 'Users can manage their own teams data'
  ) THEN
    CREATE POLICY "Users can manage their own teams data"
      ON teams
      FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_teams_user_id ON teams(user_id);
CREATE INDEX IF NOT EXISTS idx_teams_created_at ON teams(created_at);
CREATE INDEX IF NOT EXISTS idx_teams_login ON teams(login);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at on teams table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_teams_updated_at'
  ) THEN
    CREATE TRIGGER update_teams_updated_at
      BEFORE UPDATE ON teams
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;