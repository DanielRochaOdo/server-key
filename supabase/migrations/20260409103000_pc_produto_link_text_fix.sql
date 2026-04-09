set search_path = public;

alter table if exists public.pc_protocolo_itens
  add column if not exists link text;

alter table if exists public.pc_protocolo_itens
  alter column produto type text using produto::text;

alter table if exists public.pc_protocolo_itens
  alter column link type text using link::text;

alter table if exists public.pc_mensal_itens
  alter column item type text using item::text;
