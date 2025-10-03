/*
  # Add nome and telefone columns to users table

  1. Changes
    - Add `nome` column (text, nullable) to store user's full name
    - Add `telefone` column (text, nullable) to store user's phone number
    
  2. Notes
    - Both fields are optional (nullable)
    - These fields can only be updated with password confirmation
    - If nome is not set, the system will fall back to the existing 'name' field
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'nome'
  ) THEN
    ALTER TABLE users ADD COLUMN nome text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'telefone'
  ) THEN
    ALTER TABLE users ADD COLUMN telefone text;
  END IF;
END $$;