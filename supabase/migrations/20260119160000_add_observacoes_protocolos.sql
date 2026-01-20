-- Add observações column to store protocol-specific notes without touching mensal
alter table public.pc_protocolos
  add column if not exists observacoes text;
