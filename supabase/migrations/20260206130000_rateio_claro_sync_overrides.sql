-- Rateio Claro Sync Overrides
-- Armazena escolhas "manter HUB" para nao reaparecer no modal

create table if not exists public.rateio_claro_sync_overrides (
  numero_linha text primary key,
  planilha_hash text not null,
  user_id uuid,
  updated_at timestamptz not null default now()
);

alter table public.rateio_claro_sync_overrides enable row level security;
