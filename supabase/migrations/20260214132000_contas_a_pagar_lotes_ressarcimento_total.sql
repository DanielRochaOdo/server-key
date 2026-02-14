/*
  # Add ressarcimento_total to lotes
*/

ALTER TABLE contas_a_pagar_lotes
  ADD COLUMN IF NOT EXISTS ressarcimento_total integer NOT NULL DEFAULT 0;
