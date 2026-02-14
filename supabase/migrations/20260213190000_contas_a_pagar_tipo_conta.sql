-- Add tipo_conta to contas_a_pagar (fixa vs avulsa)
ALTER TABLE contas_a_pagar
  ADD COLUMN IF NOT EXISTS tipo_conta text;

ALTER TABLE contas_a_pagar
  ALTER COLUMN tipo_conta SET DEFAULT 'fixa';

UPDATE contas_a_pagar
SET tipo_conta = 'fixa'
WHERE tipo_conta IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contas_a_pagar_tipo_conta_check'
  ) THEN
    ALTER TABLE contas_a_pagar
      ADD CONSTRAINT contas_a_pagar_tipo_conta_check
      CHECK (tipo_conta IN ('fixa', 'avulsa'));
  END IF;
END $$;
