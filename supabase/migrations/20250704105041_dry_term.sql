/*
  # Fix rateio_claro table column name

  1. Table Updates
    - Rename 'completo' column to 'nome' in rateio_claro table
    - Update any existing data to maintain consistency

  2. Performance
    - Update indexes to reflect new column name
*/

-- Rename the column from 'completo' to 'nome'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rateio_claro' AND column_name = 'completo'
  ) THEN
    ALTER TABLE rateio_claro RENAME COLUMN completo TO nome;
  END IF;
END $$;

-- Update any existing policies or indexes if needed
-- The existing indexes and policies should automatically work with the renamed column