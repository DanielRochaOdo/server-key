-- Ensure saving a protocolo always resyncs the Mensal entries even after edits
create or replace function public.pc_copy_to_mensal_on_save()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'SALVO' then
    delete from public.pc_mensal_itens where protocolo_id = new.id;

    insert into public.pc_mensal_itens (
      ano, mes, item, quantidade, valor_unit, valor_total_frete,
      setor, status, protocolo_id, protocolo_item_id
    )
    select
      new.ano,
      new.mes,
      i.produto,
      i.quantidade,
      i.valor_unit,
      i.valor_total,
      'TI',
      'PEDIDO_FEITO'::public.pc_status_mensal,
      new.id,
      i.id
    from public.pc_protocolo_itens i
    where i.protocolo_id = new.id;
  end if;

  return new;
end;
$$;
