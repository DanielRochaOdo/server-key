/*
  # Relax contas_a_pagar required fields for imports

  1. Changes
    - Allow NULLs for all data columns
    - Allow NULL status_documento values by updating check constraint
*/

ALTER TABLE contas_a_pagar
  ALTER COLUMN status_documento DROP NOT NULL,
  ALTER COLUMN fornecedor DROP NOT NULL,
  ALTER COLUMN descricao DROP NOT NULL,
  ALTER COLUMN valor DROP NOT NULL,
  ALTER COLUMN vencimento DROP NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contas_a_pagar_status_check'
  ) THEN
    ALTER TABLE contas_a_pagar DROP CONSTRAINT contas_a_pagar_status_check;
  END IF;
END $$;

ALTER TABLE contas_a_pagar
  ADD CONSTRAINT contas_a_pagar_status_check
  CHECK (
    status_documento IS NULL OR
    status_documento IN ('Nao emitido', 'Emitido pendente assinatura', 'Enviado financeiro')
  );
