/*
  # Add ressarcimento to tipo_conta and lotes constraints
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contas_a_pagar_tipo_conta_check'
  ) THEN
    ALTER TABLE contas_a_pagar DROP CONSTRAINT contas_a_pagar_tipo_conta_check;
  END IF;
END $$;

ALTER TABLE contas_a_pagar
  ADD CONSTRAINT contas_a_pagar_tipo_conta_check
  CHECK (tipo_conta IN ('fixa', 'avulsa', 'ressarcimento'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contas_a_pagar_lotes_origem_check'
  ) THEN
    ALTER TABLE contas_a_pagar_lotes DROP CONSTRAINT contas_a_pagar_lotes_origem_check;
  END IF;
END $$;

ALTER TABLE contas_a_pagar_lotes
  ADD CONSTRAINT contas_a_pagar_lotes_origem_check
  CHECK (origem IN ('fixa', 'avulsa', 'ressarcimento', 'misto'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contas_a_pagar_lote_itens_tipo_conta_check'
  ) THEN
    ALTER TABLE contas_a_pagar_lote_itens DROP CONSTRAINT contas_a_pagar_lote_itens_tipo_conta_check;
  END IF;
END $$;

ALTER TABLE contas_a_pagar_lote_itens
  ADD CONSTRAINT contas_a_pagar_lote_itens_tipo_conta_check
  CHECK (tipo_conta IN ('fixa', 'avulsa', 'ressarcimento') OR tipo_conta IS NULL);
