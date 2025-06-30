/*
  # Create teams management table

  1. New Tables
    - `teams`
      - `id` (uuid, primary key)
      - `login` (text, required) - Team login
      - `senha` (text, required) - Team password
      - `usuario` (text, required) - Team user/member
      - `observacao` (text, optional) - Observations/notes
      - `user_id` (uuid, foreign key) - User who created the record
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `teams` table
    - Add policy for authenticated users to manage their own data

  3. Triggers
    - Auto-update `updated_at` timestamp on record updates
*/

-- Create the teams table
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  login text NOT NULL,
  senha text NOT NULL,
  usuario text NOT NULL,
  observacao text,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to manage their own data
CREATE POLICY "Users can manage their own teams data"
  ON teams
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

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