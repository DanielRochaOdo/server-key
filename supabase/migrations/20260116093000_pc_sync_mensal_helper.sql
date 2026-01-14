-- Introduce helper to keep Mensal synced when a saved protocolo changes
create or replace function public.pc_sync_mensal_for_protocol(p_protocolo_id uuid)
returns void
language plpgsql
as $$
declare
  protocolo_status public.pc_status_protocolo;
begin
  if p_protocolo_id is null then
    return;
  end if;

  select status
  into protocolo_status
  from public.pc_protocolos
  where id = p_protocolo_id;

  if protocolo_status is distinct from 'SALVO' then
    return;
  end if;

  delete from public.pc_mensal_itens
  where protocolo_id = p_protocolo_id;

  insert into public.pc_mensal_itens (
    ano, mes, item, quantidade, valor_unit, valor_total_frete,
    setor, status, protocolo_id, protocolo_item_id
  )
  select
    p.ano,
    p.mes,
    i.produto,
    i.quantidade,
    i.valor_unit,
    i.valor_total,
    'TI',
    'PEDIDO_FEITO'::public.pc_status_mensal,
    p.id,
    i.id
  from public.pc_protocolo_itens i
  join public.pc_protocolos p on p.id = i.protocolo_id
  where p.id = p_protocolo_id;
end;
$$;

create or replace function public.pc_copy_to_mensal_on_save()
returns trigger
language plpgsql
as $$
begin
  if (old.status is distinct from new.status) and (new.status = 'SALVO') then
    perform public.pc_sync_mensal_for_protocol(new.id);
  end if;
  return new;
end;
$$;

create or replace function public.pc_protocol_items_after_change()
returns trigger
language plpgsql
as $$
declare
  pid uuid;
begin
  pid := coalesce(new.protocolo_id, old.protocolo_id);
  if pid is null then
    return null;
  end if;

  perform public.pc_recalc_protocol_total(pid);
  perform public.pc_sync_mensal_for_protocol(pid);
  return null;
end;
$$;
