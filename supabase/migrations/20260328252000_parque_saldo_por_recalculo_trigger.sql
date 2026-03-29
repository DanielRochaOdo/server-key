set search_path = public;

-- Recalcula saldo/custo de um produto com base em todas as movimentações.
create or replace function public.parque_recalcular_produto_saldo(p_produto_id uuid)
returns void
language plpgsql
as $$
declare
  v_qtd numeric(14,2);
  v_custo_total numeric(14,2);
  v_qtd_com_custo numeric(14,2);
begin
  if p_produto_id is null then
    return;
  end if;

  select
    coalesce(
      sum(
        case
          when public.parque_movimentacao_delta(pm.tipo_movimentacao, pm.destino_tipo, pm.destino_descricao) = 1
            then pm.quantidade
          else -pm.quantidade
        end
      ),
      0
    )::numeric(14,2),
    coalesce(
      sum(
        case
          when public.parque_movimentacao_delta(pm.tipo_movimentacao, pm.destino_tipo, pm.destino_descricao) = 1
            and coalesce(pm.custo_unitario, 0) > 0
          then (pm.quantidade * pm.custo_unitario)
          else 0
        end
      ),
      0
    )::numeric(14,2),
    coalesce(
      sum(
        case
          when public.parque_movimentacao_delta(pm.tipo_movimentacao, pm.destino_tipo, pm.destino_descricao) = 1
            and coalesce(pm.custo_unitario, 0) > 0
          then pm.quantidade
          else 0
        end
      ),
      0
    )::numeric(14,2)
  into v_qtd, v_custo_total, v_qtd_com_custo
  from public.parque_movimentacoes pm
  where pm.produto_id = p_produto_id;

  update public.parque_produtos p
  set
    quantidade_atual = greatest(v_qtd, 0),
    custo_medio_atual = case
      when v_qtd_com_custo > 0 then round((v_custo_total / v_qtd_com_custo)::numeric, 2)
      else 0
    end,
    updated_at = now()
  where p.id = p_produto_id;
end;
$$;

-- Trigger único para manter saldo consistente em insert/update/delete.
create or replace function public.parque_after_write_movimentacao()
returns trigger
language plpgsql
as $$
declare
  clinic_movement_id uuid;
  clinic_label text;
begin
  if tg_op = 'INSERT' then
    if new.tipo_movimentacao = 'saida_clinica' and new.custo_clinica_id is null then
      clinic_label := coalesce(new.destino_descricao, 'Clinica');
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
        clinic_label,
        coalesce(public.parque_produto_label(new.produto_id), 'Produto'),
        coalesce(nullif(new.origem_descricao, ''), 'PARQUE TECNOLOGICO'),
        round(new.quantidade)::integer,
        coalesce(new.custo_unitario, 0),
        round((new.quantidade * coalesce(new.custo_unitario, 0))::numeric, 2),
        new.created_by,
        now()
      ) returning id into clinic_movement_id;

      update public.parque_movimentacoes
      set custo_clinica_id = clinic_movement_id
      where id = new.id;
    end if;

    perform public.parque_recalcular_produto_saldo(new.produto_id);
    return null;
  end if;

  if tg_op = 'UPDATE' then
    if old.produto_id is distinct from new.produto_id then
      perform public.parque_recalcular_produto_saldo(old.produto_id);
    end if;
    perform public.parque_recalcular_produto_saldo(new.produto_id);
    return null;
  end if;

  if tg_op = 'DELETE' then
    perform public.parque_recalcular_produto_saldo(old.produto_id);
    return null;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_parque_after_insert_movimentacao on public.parque_movimentacoes;
drop trigger if exists trg_parque_after_update_movimentacao on public.parque_movimentacoes;
drop trigger if exists trg_parque_after_delete_movimentacao on public.parque_movimentacoes;

create trigger trg_parque_after_insert_movimentacao
after insert on public.parque_movimentacoes
for each row execute function public.parque_after_write_movimentacao();

create trigger trg_parque_after_update_movimentacao
after update on public.parque_movimentacoes
for each row execute function public.parque_after_write_movimentacao();

create trigger trg_parque_after_delete_movimentacao
after delete on public.parque_movimentacoes
for each row execute function public.parque_after_write_movimentacao();

grant execute on function public.parque_recalcular_produto_saldo(uuid) to authenticated;
grant execute on function public.parque_after_write_movimentacao() to authenticated;

-- Recalcula todos os produtos para corrigir divergências antigas.
do $$
declare
  v_produto_id uuid;
begin
  for v_produto_id in
    select id from public.parque_produtos
  loop
    perform public.parque_recalcular_produto_saldo(v_produto_id);
  end loop;
end;
$$;
