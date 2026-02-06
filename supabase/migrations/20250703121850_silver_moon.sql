/*
  # Update Rateio Google table structure

  1. Table Updates
    - Drop existing columns that don't match requirements
    - Add correct columns: nome_completo, email, status, ultimo_login, armazenamento, situacao
    - Keep user_id, created_at, updated_at for system functionality

  2. Security
    - Maintain existing RLS policies
    - Keep existing indexes where applicable

  3. Data Migration
    - Safely update existing data structure
*/

-- First, let's safely update the table structure
DO $$
BEGIN
  -- Add new columns if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rateio_google' AND column_name = 'nome_completo'
  ) THEN
    ALTER TABLE rateio_google ADD COLUMN nome_completo text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rateio_google' AND column_name = 'email'
  ) THEN
    ALTER TABLE rateio_google ADD COLUMN email text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rateio_google' AND column_name = 'status'
  ) THEN
    ALTER TABLE rateio_google ADD COLUMN status text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rateio_google' AND column_name = 'ultimo_login'
  ) THEN
    ALTER TABLE rateio_google ADD COLUMN ultimo_login timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rateio_google' AND column_name = 'armazenamento'
  ) THEN
    ALTER TABLE rateio_google ADD COLUMN armazenamento text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rateio_google' AND column_name = 'situacao'
  ) THEN
    ALTER TABLE rateio_google ADD COLUMN situacao text;
  END IF;
END $$;

-- Migrate existing data from 'completo' to 'nome_completo' if needed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rateio_google' AND column_name = 'completo'
  ) THEN
    UPDATE rateio_google
    SET nome_completo = completo
    WHERE nome_completo IS NULL AND completo IS NOT NULL;
  END IF;
END $$;

-- Drop old columns that are no longer needed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rateio_google' AND column_name = 'completo'
  ) THEN
    ALTER TABLE rateio_google DROP COLUMN completo;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rateio_google' AND column_name = 'servico'
  ) THEN
    ALTER TABLE rateio_google DROP COLUMN servico;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rateio_google' AND column_name = 'responsavel_atual'
  ) THEN
    ALTER TABLE rateio_google DROP COLUMN responsavel_atual;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rateio_google' AND column_name = 'setor'
  ) THEN
    ALTER TABLE rateio_google DROP COLUMN setor;
  END IF;
END $$;

-- Update indexes for new structure
DROP INDEX IF EXISTS idx_rateio_google_servico;
DROP INDEX IF EXISTS idx_rateio_google_setor;

-- Create new indexes for better performance
CREATE INDEX IF NOT EXISTS idx_rateio_google_nome_completo ON rateio_google(nome_completo);
CREATE INDEX IF NOT EXISTS idx_rateio_google_email ON rateio_google(email);
CREATE INDEX IF NOT EXISTS idx_rateio_google_status ON rateio_google(status);
CREATE INDEX IF NOT EXISTS idx_rateio_google_situacao ON rateio_google(situacao);
