/*
  # Create Rateio Claro table

  1. New Tables
    - `rateio_claro`
      - `id` (uuid, primary key)
      - `completo` (text, required) - Complete information
      - `numero_linha` (text) - Line number
      - `responsavel_atual` (text) - Current responsible person
      - `setor` (text) - Department/Sector
      - `user_id` (uuid, foreign key) - User who created the record
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `rateio_claro` table
    - Add policy for authenticated users to manage their own data

  3. Performance
    - Add indexes for better query performance
*/

CREATE TABLE IF NOT EXISTS rateio_claro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  completo text NOT NULL,
  numero_linha text,
  responsavel_atual text,
  setor text,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE rateio_claro ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own rateio claro data"
  ON rateio_claro
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create policies for reading all data (if needed for general access)
CREATE POLICY "Todos podem ler rateio claro"
  ON rateio_claro
  FOR SELECT
  TO authenticated
  USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_rateio_claro_user_id ON rateio_claro(user_id);
CREATE INDEX IF NOT EXISTS idx_rateio_claro_created_at ON rateio_claro(created_at);
CREATE INDEX IF NOT EXISTS idx_rateio_claro_numero_linha ON rateio_claro(numero_linha);
CREATE INDEX IF NOT EXISTS idx_rateio_claro_setor ON rateio_claro(setor);

-- Create trigger to automatically update updated_at timestamp
DROP TRIGGER IF EXISTS update_rateio_claro_updated_at ON rateio_claro;
CREATE TRIGGER update_rateio_claro_updated_at
  BEFORE UPDATE ON rateio_claro
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
