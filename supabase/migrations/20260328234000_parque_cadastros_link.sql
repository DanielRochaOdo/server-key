set search_path = public;

create table if not exists public.parque_cadastros_link (
  id uuid primary key default gen_random_uuid(),
  origem_tipo text not null,
  origem_id uuid not null,
  destino_tipo text not null,
  destino_id uuid not null,
  ativo boolean not null default true,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint parque_cadastros_link_origem_unique unique (origem_tipo, origem_id),
  constraint parque_cadastros_link_distinct check (
    not (origem_tipo = destino_tipo and origem_id = destino_id)
  ),
  constraint parque_cadastros_link_origem_tipo_check check (
    origem_tipo in (
      'itens',
      'unidades',
      'marcas',
      'categorias_produto',
      'especificacoes_produto',
      'setores',
      'tipos_movimentacao',
      'tipos_origem',
      'tipos_destino',
      'descricoes_destino'
    )
  ),
  constraint parque_cadastros_link_destino_tipo_check check (
    destino_tipo in (
      'itens',
      'unidades',
      'marcas',
      'categorias_produto',
      'especificacoes_produto',
      'setores',
      'tipos_movimentacao',
      'tipos_origem',
      'tipos_destino',
      'descricoes_destino'
    )
  )
);

create index if not exists parque_cadastros_link_origem_idx
  on public.parque_cadastros_link (origem_tipo, origem_id, ativo);

create index if not exists parque_cadastros_link_destino_idx
  on public.parque_cadastros_link (destino_tipo, destino_id, ativo);

drop trigger if exists trg_parque_cadastros_link_updated_at on public.parque_cadastros_link;
create trigger trg_parque_cadastros_link_updated_at
before update on public.parque_cadastros_link
for each row execute function public.parque_set_updated_at();

create or replace function public.parque_cadastro_base_exists(p_tipo text, p_id uuid)
returns boolean
language plpgsql
stable
as $$
declare
  found_row boolean;
begin
  if p_tipo = 'itens' then
    select exists(select 1 from public.parque_itens_base where id = p_id) into found_row;
    return coalesce(found_row, false);
  end if;

  if p_tipo = 'unidades' then
    select exists(select 1 from public.parque_unidades_base where id = p_id) into found_row;
    return coalesce(found_row, false);
  end if;

  if p_tipo = 'marcas' then
    select exists(select 1 from public.parque_marcas_base where id = p_id) into found_row;
    return coalesce(found_row, false);
  end if;

  if p_tipo = 'categorias_produto' then
    select exists(select 1 from public.parque_parametros_base where id = p_id and categoria = 'categoria_produto') into found_row;
    return coalesce(found_row, false);
  end if;

  if p_tipo = 'especificacoes_produto' then
    select exists(select 1 from public.parque_parametros_base where id = p_id and categoria = 'especificacao_produto') into found_row;
    return coalesce(found_row, false);
  end if;

  if p_tipo = 'setores' then
    select exists(select 1 from public.parque_parametros_base where id = p_id and categoria = 'setor') into found_row;
    return coalesce(found_row, false);
  end if;

  if p_tipo = 'tipos_movimentacao' then
    select exists(select 1 from public.parque_parametros_base where id = p_id and categoria = 'tipo_movimentacao') into found_row;
    return coalesce(found_row, false);
  end if;

  if p_tipo = 'tipos_origem' then
    select exists(select 1 from public.parque_parametros_base where id = p_id and categoria = 'origem_tipo') into found_row;
    return coalesce(found_row, false);
  end if;

  if p_tipo = 'tipos_destino' then
    select exists(select 1 from public.parque_parametros_base where id = p_id and categoria = 'destino_tipo') into found_row;
    return coalesce(found_row, false);
  end if;

  if p_tipo = 'descricoes_destino' then
    select exists(select 1 from public.parque_parametros_base where id = p_id and categoria = 'destino_descricao') into found_row;
    return coalesce(found_row, false);
  end if;

  return false;
end;
$$;

create or replace function public.parque_validate_cadastros_link()
returns trigger
language plpgsql
as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;

  if not public.parque_cadastro_base_exists(new.origem_tipo, new.origem_id) then
    raise exception 'Cadastro de origem inválido para o tipo informado.';
  end if;

  if not public.parque_cadastro_base_exists(new.destino_tipo, new.destino_id) then
    raise exception 'Cadastro de destino inválido para o tipo informado.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_parque_cadastros_link_validate on public.parque_cadastros_link;
create trigger trg_parque_cadastros_link_validate
before insert or update on public.parque_cadastros_link
for each row execute function public.parque_validate_cadastros_link();

alter table public.parque_cadastros_link enable row level security;

drop policy if exists parque_cadastros_link_read on public.parque_cadastros_link;
create policy parque_cadastros_link_read
on public.parque_cadastros_link
for select
to authenticated
using (has_module_access('parque_tecnologico'));

drop policy if exists parque_cadastros_link_manage on public.parque_cadastros_link;
create policy parque_cadastros_link_manage
on public.parque_cadastros_link
for all
to authenticated
using (has_module_edit_access('parque_tecnologico'))
with check (has_module_edit_access('parque_tecnologico'));
