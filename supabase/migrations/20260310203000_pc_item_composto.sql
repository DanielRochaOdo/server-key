/*
  # Pedidos de Compra - Item Composto

  1) Protocolo item pode ser composto com filhos (jsonb)
  2) Mensal passa a usar chave de origem para permitir 1 pai -> N filhos
  3) Sync para mensal envia apenas filhos quando item pai for composto
*/

alter table public.pc_protocolo_itens
  add column if not exists composto boolean not null default false;

alter table public.pc_protocolo_itens
  add column if not exists filhos jsonb not null default '[]'::jsonb;

update public.pc_protocolo_itens
set filhos = '[]'::jsonb
where filhos is null;

alter table public.pc_mensal_itens
  add column if not exists origem_chave text;

update public.pc_mensal_itens
set origem_chave = coalesce(origem_chave, protocolo_item_id::text)
where protocolo_item_id is not null;

drop index if exists public.pc_mensal_unique_protocolo_item;

create unique index if not exists pc_mensal_unique_origem_chave
  on public.pc_mensal_itens (origem_chave)
  where origem_chave is not null;

create index if not exists pc_mensal_protocolo_item_idx
  on public.pc_mensal_itens (protocolo_item_id);

create or replace function public.pc_sync_mensal_from_protocolo(p_protocolo_id uuid)
returns void
language plpgsql
as $$
declare
  v_proto record;
begin
  if p_protocolo_id is null then
    return;
  end if;

  select id, ano, mes, status
  into v_proto
  from public.pc_protocolos
  where id = p_protocolo_id;

  if not found or v_proto.status is distinct from 'SALVO' then
    return;
  end if;

  delete from public.pc_mensal_itens
  where protocolo_id = v_proto.id
    and status <> 'ENTREGUE';

  insert into public.pc_mensal_itens (
    ano, mes, item, quantidade, valor_unit, valor_total_frete,
    setor, status, diretoria, protocolo_id, protocolo_item_id, origem_chave
  )
  select
    v_proto.ano,
    v_proto.mes,
    src.item,
    src.quantidade,
    src.valor_unit,
    src.valor_total_frete,
    'TI',
    'PEDIDO_FEITO'::public.pc_status_mensal,
    src.diretoria,
    v_proto.id,
    src.protocolo_item_id,
    src.origem_chave
  from (
    select
      i.produto as item,
      i.quantidade,
      i.valor_unit,
      round((i.valor_total + coalesce(i.frete, 0))::numeric, 2) as valor_total_frete,
      i.diretoria,
      i.id as protocolo_item_id,
      i.id::text as origem_chave
    from public.pc_protocolo_itens i
    where i.protocolo_id = v_proto.id
      and (
        coalesce(i.composto, false) = false
        or coalesce(jsonb_array_length(i.filhos), 0) = 0
      )

    union all

    select
      upper(trim(coalesce(f.elem->>'nome', ''))) as item,
      coalesce(nullif(f.elem->>'quantidade', '')::numeric, 0) as quantidade,
      coalesce(nullif(f.elem->>'valor_unit', '')::numeric, 0) as valor_unit,
      round((
        coalesce(nullif(f.elem->>'quantidade', '')::numeric, 0) *
        coalesce(nullif(f.elem->>'valor_unit', '')::numeric, 0)
      )::numeric, 2) as valor_total_frete,
      i.diretoria,
      i.id as protocolo_item_id,
      (i.id::text || ':' || coalesce(nullif(f.elem->>'id', ''), md5(f.elem::text))) as origem_chave
    from public.pc_protocolo_itens i
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(i.filhos) = 'array' then i.filhos
        else '[]'::jsonb
      end
    ) as f(elem)
    where i.protocolo_id = v_proto.id
      and coalesce(i.composto, false) = true
  ) src
  where src.item <> ''
    and src.quantidade > 0
    and src.valor_unit >= 0
  on conflict (origem_chave) do update
  set
    ano               = excluded.ano,
    mes               = excluded.mes,
    item              = excluded.item,
    quantidade        = excluded.quantidade,
    valor_unit        = excluded.valor_unit,
    valor_total_frete = excluded.valor_total_frete,
    setor             = excluded.setor,
    diretoria         = excluded.diretoria,
    protocolo_id      = excluded.protocolo_id,
    protocolo_item_id = excluded.protocolo_item_id,
    status            = case
                          when public.pc_mensal_itens.status = 'ENTREGUE' then 'ENTREGUE'
                          else excluded.status
                        end;
end;
$$;
