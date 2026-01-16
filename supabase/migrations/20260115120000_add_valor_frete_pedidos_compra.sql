-- Add freight field to protocolo and mensal items and include it when calculating totals.

-- 1) Add new column for freight on protocolo items
alter table public.pc_protocolo_itens
  add column if not exists valor_frete numeric(12,2) not null default 0;

-- 2) Add freight column for the mensal consolidated table
alter table public.pc_mensal_itens
  add column if not exists valor_frete numeric(12,2) not null default 0;

-- 3) Recalculate protocol totals including freight
create or replace function public.pc_recalc_protocol_total(p_protocolo_id uuid)
returns void
language plpgsql
as $$
begin
  update public.pc_protocolos p
  set valor_final = coalesce((
    select round(sum(i.valor_total + i.valor_frete)::numeric, 2)
    from public.pc_protocolo_itens i
    where i.protocolo_id = p_protocolo_id
  ), 0)
  where p.id = p_protocolo_id;
end;
$$;

-- 4) Ensure mensal copy stores freight
create or replace function public.pc_copy_to_mensal_on_save()
returns trigger
language plpgsql
as $$
begin
  if (old.status is distinct from new.status) and (new.status = 'SALVO') then
    insert into public.pc_mensal_itens (
      ano, mes, item, quantidade, valor_unit, valor_total_frete,
      valor_frete, setor, status, diretoria, protocolo_id, protocolo_item_id
    )
    select
      new.ano,
      new.mes,
      i.produto as item,
      i.quantidade,
      i.valor_unit,
      (i.valor_total + i.valor_frete) as valor_total_frete,
      i.valor_frete,
      'TI' as setor,
      'PEDIDO_FEITO'::public.pc_status_mensal,
      i.diretoria as diretoria,
      new.id,
      i.id
    from public.pc_protocolo_itens i
    where i.protocolo_id = new.id
    on conflict (protocolo_item_id) do update
    set
      quantidade = excluded.quantidade,
      valor_unit = excluded.valor_unit,
      valor_total_frete = excluded.valor_total_frete,
      valor_frete = excluded.valor_frete,
      setor = excluded.setor,
      status = excluded.status,
      diretoria = excluded.diretoria,
      updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_pc_copy_to_mensal on public.pc_protocolos;
create trigger trg_pc_copy_to_mensal
after update on public.pc_protocolos
for each row execute function public.pc_copy_to_mensal_on_save();
