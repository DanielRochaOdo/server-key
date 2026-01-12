-- Add link column to contas_a_pagar (optional)
ALTER TABLE contas_a_pagar
  ADD COLUMN IF NOT EXISTS link text;
