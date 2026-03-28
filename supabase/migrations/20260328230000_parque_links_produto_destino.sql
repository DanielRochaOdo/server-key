set search_path = public;

create table if not exists public.parque_item_parametros_link (
  id uuid primary key default gen_random_uuid(),
  item_base_id uuid not null references public.parque_itens_base(id) on delete cascade,
  categoria_parametro_id uuid null constraint parque_item_parametros_link_categoria_fkey references public.parque_parametros_base(id) on delete set null,
  especificacao_parametro_id uuid null constraint parque_item_parametros_link_especificacao_fkey references public.parque_parametros_base(id) on delete set null,
  unidade_base_id uuid null references public.parque_unidades_base(id) on delete set null,
  marca_base_id uuid null references public.parque_marcas_base(id) on delete set null,
  ativo boolean not null default true,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint parque_item_parametros_link_item_unique unique (item_base_id)
);

create table if not exists public.parque_destino_setor_link (
  id uuid primary key default gen_random_uuid(),
  destino_parametro_id uuid not null constraint parque_destino_setor_link_destino_fkey references public.parque_parametros_base(id) on delete cascade,
  setor_parametro_id uuid not null constraint parque_destino_setor_link_setor_fkey references public.parque_parametros_base(id) on delete restrict,
  ativo boolean not null default true,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint parque_destino_setor_link_destino_unique unique (destino_parametro_id)
);

create index if not exists parque_item_parametros_link_ativo_idx
  on public.parque_item_parametros_link (ativo, item_base_id);

create index if not exists parque_destino_setor_link_ativo_idx
  on public.parque_destino_setor_link (ativo, destino_parametro_id);

drop trigger if exists trg_parque_item_parametros_link_updated_at on public.parque_item_parametros_link;
create trigger trg_parque_item_parametros_link_updated_at
before update on public.parque_item_parametros_link
for each row execute function public.parque_set_updated_at();

drop trigger if exists trg_parque_destino_setor_link_updated_at on public.parque_destino_setor_link;
create trigger trg_parque_destino_setor_link_updated_at
before update on public.parque_destino_setor_link
for each row execute function public.parque_set_updated_at();

create or replace function public.parque_validate_item_parametros_link()
returns trigger
language plpgsql
as $$
declare
  categoria_tipo text;
  especificacao_tipo text;
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;

  if new.categoria_parametro_id is not null then
    select categoria into categoria_tipo
    from public.parque_parametros_base
    where id = new.categoria_parametro_id;

    if categoria_tipo is null or categoria_tipo <> 'categoria_produto' then
      raise exception 'Categoria vinculada inválida.';
    end if;
  end if;

  if new.especificacao_parametro_id is not null then
    select categoria into especificacao_tipo
    from public.parque_parametros_base
    where id = new.especificacao_parametro_id;

    if especificacao_tipo is null or especificacao_tipo <> 'especificacao_produto' then
      raise exception 'Especificação vinculada inválida.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.parque_validate_destino_setor_link()
returns trigger
language plpgsql
as $$
declare
  destino_tipo text;
  setor_tipo text;
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;

  select categoria into destino_tipo
  from public.parque_parametros_base
  where id = new.destino_parametro_id;

  if destino_tipo is null or destino_tipo <> 'destino_descricao' then
    raise exception 'Destino vinculado inválido.';
  end if;

  select categoria into setor_tipo
  from public.parque_parametros_base
  where id = new.setor_parametro_id;

  if setor_tipo is null or setor_tipo <> 'setor' then
    raise exception 'Setor vinculado inválido.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_parque_item_parametros_link_validate on public.parque_item_parametros_link;
create trigger trg_parque_item_parametros_link_validate
before insert or update on public.parque_item_parametros_link
for each row execute function public.parque_validate_item_parametros_link();

drop trigger if exists trg_parque_destino_setor_link_validate on public.parque_destino_setor_link;
create trigger trg_parque_destino_setor_link_validate
before insert or update on public.parque_destino_setor_link
for each row execute function public.parque_validate_destino_setor_link();

alter table public.parque_item_parametros_link enable row level security;
alter table public.parque_destino_setor_link enable row level security;

drop policy if exists parque_item_parametros_link_read on public.parque_item_parametros_link;
create policy parque_item_parametros_link_read
on public.parque_item_parametros_link
for select
to authenticated
using (has_module_access('parque_tecnologico'));

drop policy if exists parque_item_parametros_link_manage on public.parque_item_parametros_link;
create policy parque_item_parametros_link_manage
on public.parque_item_parametros_link
for all
to authenticated
using (has_module_edit_access('parque_tecnologico'))
with check (has_module_edit_access('parque_tecnologico'));

drop policy if exists parque_destino_setor_link_read on public.parque_destino_setor_link;
create policy parque_destino_setor_link_read
on public.parque_destino_setor_link
for select
to authenticated
using (has_module_access('parque_tecnologico'));

drop policy if exists parque_destino_setor_link_manage on public.parque_destino_setor_link;
create policy parque_destino_setor_link_manage
on public.parque_destino_setor_link
for all
to authenticated
using (has_module_edit_access('parque_tecnologico'))
with check (has_module_edit_access('parque_tecnologico'));

create or replace function public.parque_after_insert_movimentacao()
returns trigger
language plpgsql
as $$
declare
  produto_row public.parque_produtos%rowtype;
  next_quantity numeric(14,2);
  next_cost numeric(14,2);
  total_cost_acc numeric(14,2);
  clinic_movement_id uuid;
  clinic_key text;
  store_label text;
begin
  select * into produto_row
  from public.parque_produtos
  where id = new.produto_id
  for update;

  if public.parque_tipo_delta(new.tipo_movimentacao) = 1 then
    next_quantity := coalesce(produto_row.quantidade_atual, 0) + new.quantidade;
    if coalesce(new.custo_unitario, 0) > 0 then
      total_cost_acc := (coalesce(produto_row.quantidade_atual, 0) * coalesce(produto_row.custo_medio_atual, 0)) + (new.quantidade * new.custo_unitario);
      next_cost := case when next_quantity > 0 then round((total_cost_acc / next_quantity)::numeric, 2) else 0 end;
    else
      next_cost := coalesce(produto_row.custo_medio_atual, 0);
    end if;
  else
    next_quantity := coalesce(produto_row.quantidade_atual, 0) - new.quantidade;
    if next_quantity < 0 then
      raise exception 'Saldo negativo nao permitido.';
    end if;
    next_cost := coalesce(produto_row.custo_medio_atual, 0);
  end if;

  update public.parque_produtos
  set quantidade_atual = next_quantity,
      custo_medio_atual = next_cost,
      updated_at = now()
  where id = new.produto_id;

  if new.tipo_movimentacao = 'saida_clinica' then
    clinic_key := public.parque_normalize_clinic_key(new.destino_descricao);
    if clinic_key is null then
      raise exception 'Clinica invalida para integracao com Custos das Clinicas.';
    end if;

    store_label := case
      when clinic_key = 'MATRIZ' then coalesce(public.parque_extract_matriz_setor(new.observacao), 'PARQUE TECNOLOGICO')
      else 'PARQUE TECNOLOGICO'
    end;

    insert into public.custos_clinicas_movements (
      competencia,
      clinic,
      product,
      store,
      quantity,
      unit_cost,
      total_cost,
      created_by,
      created_at
    ) values (
      date_trunc('month', new.data_movimentacao)::date,
      clinic_key,
      coalesce(public.parque_produto_label(new.produto_id), 'PRODUTO'),
      store_label,
      new.quantidade,
      coalesce(new.custo_unitario, 0),
      round((new.quantidade * coalesce(new.custo_unitario, 0))::numeric, 2),
      new.created_by,
      now()
    ) returning id into clinic_movement_id;

    update public.parque_movimentacoes
    set custo_clinica_id = clinic_movement_id,
        destino_descricao = clinic_key
    where id = new.id;
  end if;

  return null;
end;
$$;
