/*
  # Change vencimento to day (DD)

  1. Changes
    - Convert vencimento from date to smallint (day of month)
*/

ALTER TABLE contas_a_pagar
  ALTER COLUMN vencimento TYPE smallint
  USING (
    CASE
      WHEN vencimento IS NULL THEN NULL
      ELSE EXTRACT(DAY FROM vencimento)::smallint
    END
  );

ALTER TABLE contas_a_pagar
  ADD CONSTRAINT contas_a_pagar_vencimento_day_check
  CHECK (vencimento IS NULL OR (vencimento >= 1 AND vencimento <= 31));
