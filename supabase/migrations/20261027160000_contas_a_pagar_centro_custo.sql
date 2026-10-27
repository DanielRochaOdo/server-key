-- Persist the center of cost on the account so lot edits are shared across devices.
ALTER TABLE public.contas_a_pagar
  ADD COLUMN IF NOT EXISTS centro_custo text;

-- Existing accounts inherit the standard default used by the lot form.
UPDATE public.contas_a_pagar
SET centro_custo = 'adm'
WHERE centro_custo IS NULL OR btrim(centro_custo) = '';

ALTER TABLE public.contas_a_pagar
  ALTER COLUMN centro_custo SET DEFAULT 'adm',
  ALTER COLUMN centro_custo SET NOT NULL;
