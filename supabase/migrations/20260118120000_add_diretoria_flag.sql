-- add diretoria flag to protocolo items and mensal
alter table public.pc_protocolo_itens
  add column if not exists diretoria boolean not null default false;

alter table public.pc_mensal_itens
  add column if not exists diretoria boolean not null default false;

create or replace function public.pc_copy_to_mensal_on_save()
returns trigger
language plpgsql
as $$
begin
  if (old.status is distinct from new.status) and (new.status = 'SALVO') then
    insert into public.pc_mensal_itens (
      ano, mes, item, quantidade, valor_unit, valor_total_frete,
      setor, status, diretoria, protocolo_id, protocolo_item_id
    )
    select
      new.ano,
      new.mes,
      i.produto as item,
      i.quantidade,
      i.valor_unit,
      i.valor_total as valor_total_frete,
      'TI' as setor,
      'PEDIDO_FEITO'::public.pc_status_mensal,
      i.diretoria,
      new.id,
      i.id
    from public.pc_protocolo_itens i
    where i.protocolo_id = new.id;
  end if;
  return new;
end;
$$;

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
    setor, status, diretoria, protocolo_id, protocolo_item_id
  )
  select
    v_proto.ano,
    v_proto.mes,
    i.produto,
    i.quantidade,
    i.valor_unit,
    i.valor_total,
    'TI',
    'PEDIDO_FEITO'::public.pc_status_mensal,
    i.diretoria,
    v_proto.id,
    i.id
  from public.pc_protocolo_itens i
  where i.protocolo_id = v_proto.id
  on conflict (protocolo_item_id) do update
  set
    ano               = excluded.ano,
    mes               = excluded.mes,
    item              = excluded.item,
    quantidade        = excluded.quantidade,
    valor_unit        = excluded.valor_unit,
    valor_total_frete = excluded.valor_total_frete,
    setor             = excluded.setor,
    protocolo_id      = excluded.protocolo_id,
    status            = case
                          when public.pc_mensal_itens.status = 'ENTREGUE' then 'ENTREGUE'
                          else excluded.status
                        end;
end;
$$;
