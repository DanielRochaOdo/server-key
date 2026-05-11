/*
  # Add data_envio_financeiro to contas_a_pagar

  1. Changes
    - Add nullable timestamptz column data_envio_financeiro
    - Backfill existing records marked as "Enviado financeiro"
*/

ALTER TABLE contas_a_pagar
  ADD COLUMN IF NOT EXISTS data_envio_financeiro timestamptz;

UPDATE contas_a_pagar
SET data_envio_financeiro = COALESCE(updated_at, created_at, now())
WHERE status_documento = 'Enviado financeiro'
  AND data_envio_financeiro IS NULL;

