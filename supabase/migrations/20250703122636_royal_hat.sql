/*
  # Adjust ultimo_login column to string type

  1. Table Updates
    - Change ultimo_login column from timestamptz to text
    - This allows for more flexible data input from imports

  2. Data Migration
    - Convert existing timestamp data to string format
    - Preserve existing data during migration
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rateio_google' AND column_name = 'ultimo_login'
  ) THEN
    -- Convert existing timestamp data to string format before changing type
    UPDATE rateio_google
    SET ultimo_login = ultimo_login::text
    WHERE ultimo_login IS NOT NULL;

    -- Change column type from timestamptz to text if needed
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'rateio_google'
        AND column_name = 'ultimo_login'
        AND data_type <> 'text'
    ) THEN
      ALTER TABLE rateio_google
      ALTER COLUMN ultimo_login TYPE text
      USING ultimo_login::text;
    END IF;
  END IF;
END $$;
