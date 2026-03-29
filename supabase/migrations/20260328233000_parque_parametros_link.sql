set search_path = public;

create table if not exists public.parque_parametros_link (
  id uuid primary key default gen_random_uuid(),
  origem_parametro_id uuid not null
    constraint parque_parametros_link_origem_fkey
    references public.parque_parametros_base(id) on delete cascade,
  destino_parametro_id uuid not null
    constraint parque_parametros_link_destino_fkey
    references public.parque_parametros_base(id) on delete restrict,
  ativo boolean not null default true,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint parque_parametros_link_origem_unique unique (origem_parametro_id),
  constraint parque_parametros_link_distinct check (origem_parametro_id <> destino_parametro_id)
);

create index if not exists parque_parametros_link_ativo_idx
  on public.parque_parametros_link (ativo, origem_parametro_id);

drop trigger if exists trg_parque_parametros_link_updated_at on public.parque_parametros_link;
create trigger trg_parque_parametros_link_updated_at
before update on public.parque_parametros_link
for each row execute function public.parque_set_updated_at();

create or replace function public.parque_validate_parametros_link()
returns trigger
language plpgsql
as $$
declare
  origem_categoria text;
  destino_categoria text;
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;

  select categoria into origem_categoria
  from public.parque_parametros_base
  where id = new.origem_parametro_id;

  if origem_categoria is null then
    raise exception 'Parametro de origem invalido.';
  end if;

  select categoria into destino_categoria
  from public.parque_parametros_base
  where id = new.destino_parametro_id;

  if destino_categoria is null then
    raise exception 'Parametro de destino invalido.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_parque_parametros_link_validate on public.parque_parametros_link;
create trigger trg_parque_parametros_link_validate
before insert or update on public.parque_parametros_link
for each row execute function public.parque_validate_parametros_link();

alter table public.parque_parametros_link enable row level security;

drop policy if exists parque_parametros_link_read on public.parque_parametros_link;
create policy parque_parametros_link_read
on public.parque_parametros_link
for select
to authenticated
using (has_module_access('parque_tecnologico'));

drop policy if exists parque_parametros_link_manage on public.parque_parametros_link;
create policy parque_parametros_link_manage
on public.parque_parametros_link
for all
to authenticated
using (has_module_edit_access('parque_tecnologico'))
with check (has_module_edit_access('parque_tecnologico'));
