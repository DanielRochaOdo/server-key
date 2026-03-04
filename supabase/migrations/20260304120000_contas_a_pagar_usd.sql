/*
  # Add USD currency support to contas_a_pagar

  1. New Columns
    - moeda (text, default BRL)
    - valor_moeda (numeric, original value in selected currency)
    - cotacao_usd_brl (numeric, USD/BRL rate applied)
    - cotacao_atualizada_em (date, last rate update)
*/

ALTER TABLE contas_a_pagar
  ADD COLUMN IF NOT EXISTS moeda text NOT NULL DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS valor_moeda numeric(12,2),
  ADD COLUMN IF NOT EXISTS cotacao_usd_brl numeric(12,6),
  ADD COLUMN IF NOT EXISTS cotacao_atualizada_em date;

UPDATE contas_a_pagar
SET valor_moeda = valor
WHERE valor_moeda IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contas_a_pagar_moeda_check'
  ) THEN
    ALTER TABLE contas_a_pagar
      ADD CONSTRAINT contas_a_pagar_moeda_check
      CHECK (moeda IN ('BRL', 'USD'));
  END IF;
END $$;
