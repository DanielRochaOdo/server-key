set search_path = public;

alter table if exists public.parque_cadastros_link
  drop constraint if exists parque_cadastros_link_origem_unique;

create unique index if not exists parque_cadastros_link_origem_destino_unique_idx
  on public.parque_cadastros_link (origem_tipo, origem_id, destino_tipo, destino_id);
