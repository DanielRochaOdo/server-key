/*
  # Change vencimento to text (DD)

  1. Changes
    - Convert vencimento column to text for day-only storage
    - Drop day check constraint if it exists
*/

ALTER TABLE contas_a_pagar
  ALTER COLUMN vencimento TYPE text
  USING (
    CASE
      WHEN vencimento IS NULL THEN NULL
      WHEN position('-' in vencimento::text) > 0 THEN split_part(vencimento::text, '-', 3)
      ELSE vencimento::text
    END
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contas_a_pagar_vencimento_day_check'
  ) THEN
    ALTER TABLE contas_a_pagar DROP CONSTRAINT contas_a_pagar_vencimento_day_check;
  END IF;
END $$;
