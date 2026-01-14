-- Replace the protocolo -> mensal sync stack with a safe helper to avoid recursion
drop trigger if exists trg_pc_copy_to_mensal on public.pc_protocolos;
drop trigger if exists trg_pc_protocolo_itens_after_change on public.pc_protocolo_itens;
drop function if exists public.pc_copy_to_mensal_on_save();
drop function if exists public.pc_protocol_items_after_change();
drop function if exists public.pc_sync_mensal_for_protocol(uuid);
drop function if exists public.pc_sync_mensal_from_protocolo(uuid);

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

  delete from public.pc_mensal_itens where protocolo_id = v_proto.id;

  insert into public.pc_mensal_itens (
    ano, mes, item, quantidade, valor_unit, valor_total_frete,
    setor, status, protocolo_id, protocolo_item_id
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
    v_proto.id,
    i.id
  from public.pc_protocolo_itens i
  where i.protocolo_id = v_proto.id;
end;
$$;

create or replace function public.pc_copy_to_mensal_on_save()
returns trigger
language plpgsql
as $$
begin
  if (old.status is distinct from new.status) and (new.status = 'SALVO') then
    perform public.pc_sync_mensal_from_protocolo(new.id);
  end if;
  return new;
end;
$$;

create trigger trg_pc_copy_to_mensal
after update on public.pc_protocolos
for each row execute function public.pc_copy_to_mensal_on_save();

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
  perform public.pc_sync_mensal_from_protocolo(pid);
  return null;
end;
$$;

create trigger trg_pc_protocolo_itens_after_change
after insert or update or delete on public.pc_protocolo_itens
for each row execute function public.pc_protocol_items_after_change();
