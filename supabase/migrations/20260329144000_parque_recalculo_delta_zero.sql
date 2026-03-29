set search_path = public;

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
        case public.parque_movimentacao_delta(pm.tipo_movimentacao, pm.destino_tipo, pm.destino_descricao)
          when 1 then pm.quantidade
          when 0 then 0
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

grant execute on function public.parque_recalcular_produto_saldo(uuid) to authenticated;

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
