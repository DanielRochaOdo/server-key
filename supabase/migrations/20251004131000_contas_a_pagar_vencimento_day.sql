/*
  # Change vencimento to day (DD)

  1. Changes
    - Convert vencimento from date to smallint (day of month)
*/

DO $$
DECLARE
  column_type text;
  has_constraint boolean;
BEGIN
  SELECT data_type INTO column_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'contas_a_pagar'
    AND column_name = 'vencimento';

  IF column_type IN ('date', 'timestamp without time zone', 'timestamp with time zone') THEN
    EXECUTE $sql$
      ALTER TABLE contas_a_pagar
        ALTER COLUMN vencimento TYPE smallint
        USING (
          CASE
            WHEN vencimento IS NULL THEN NULL
            ELSE EXTRACT(DAY FROM vencimento)::smallint
          END
        );
    $sql$;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contas_a_pagar_vencimento_day_check'
  ) INTO has_constraint;

  IF NOT has_constraint THEN
    EXECUTE $sql$
      ALTER TABLE contas_a_pagar
        ADD CONSTRAINT contas_a_pagar_vencimento_day_check
        CHECK (vencimento IS NULL OR (vencimento >= 1 AND vencimento <= 31));
    $sql$;
  END IF;
END $$;
