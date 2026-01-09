/*
  # Change vencimento to integer day

  1. Changes
    - Convert vencimento to smallint day (1-31)
    - Drop old day constraint if present
*/

ALTER TABLE contas_a_pagar
  ALTER COLUMN vencimento TYPE smallint
  USING (
    CASE
      WHEN vencimento IS NULL THEN NULL
      WHEN position('-' in vencimento::text) > 0 THEN split_part(vencimento::text, '-', 3)::smallint
      ELSE NULLIF(trim(vencimento::text), '')::smallint
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

ALTER TABLE contas_a_pagar
  ADD CONSTRAINT contas_a_pagar_vencimento_day_check
  CHECK (vencimento IS NULL OR (vencimento >= 1 AND vencimento <= 31));
