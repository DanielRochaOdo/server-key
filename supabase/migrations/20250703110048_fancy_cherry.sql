/*
  # Create Rateio Google table

  1. New Tables
    - `rateio_google`
      - `id` (uuid, primary key)
      - `completo` (text, required) - Complete information
      - `servico` (text) - Google service (Gmail, Drive, Workspace, etc.)
      - `responsavel_atual` (text) - Current responsible person
      - `setor` (text) - Department/Sector
      - `user_id` (uuid, foreign key) - User who created the record
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `rateio_google` table
    - Add policy for authenticated users to manage their own data
    - Add policy for reading all data

  3. Performance
    - Add indexes for better query performance

  4. Automation
    - Add trigger to automatically update `updated_at` timestamp
*/

CREATE TABLE IF NOT EXISTS rateio_google (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  completo text NOT NULL,
  servico text,
  responsavel_atual text,
  setor text,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE rateio_google ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own rateio google data"
  ON rateio_google
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create policies for reading all data (if needed for general access)
CREATE POLICY "Todos podem ler rateio google"
  ON rateio_google
  FOR SELECT
  TO authenticated
  USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_rateio_google_user_id ON rateio_google(user_id);
CREATE INDEX IF NOT EXISTS idx_rateio_google_created_at ON rateio_google(created_at);

-- Guard optional column indexes for idempotency
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rateio_google' AND column_name = 'servico'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_rateio_google_servico ON rateio_google(servico)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rateio_google' AND column_name = 'setor'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_rateio_google_setor ON rateio_google(setor)';
  END IF;
END $$;

-- Create trigger to automatically update updated_at timestamp
DROP TRIGGER IF EXISTS update_rateio_google_updated_at ON rateio_google;
CREATE TRIGGER update_rateio_google_updated_at
  BEFORE UPDATE ON rateio_google
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
