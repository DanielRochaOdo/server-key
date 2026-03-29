set search_path = public;

-- Remove registros de entrada por pedido inseridos no fluxo antigo.
delete from public.parque_movimentacoes
where tipo_movimentacao = 'entrada_compra'
  and pedido_compra_id is not null;

-- Recalcula saldo e custo médio a partir do histórico remanescente.
with saldo_produto as (
  select
    p.id as produto_id,
    coalesce(
      sum(
        case
          when pm.tipo_movimentacao in ('entrada_manual', 'entrada_compra', 'ajuste_positivo') then pm.quantidade
          else -pm.quantidade
        end
      ),
      0
    )::numeric(14,2) as quantidade_recalculada,
    coalesce(
      sum(
        case
          when pm.tipo_movimentacao in ('entrada_manual', 'entrada_compra', 'ajuste_positivo')
            and coalesce(pm.custo_unitario, 0) > 0
          then (pm.quantidade * pm.custo_unitario)
          else 0
        end
      ),
      0
    )::numeric(14,2) as custo_total_entrada,
    coalesce(
      sum(
        case
          when pm.tipo_movimentacao in ('entrada_manual', 'entrada_compra', 'ajuste_positivo')
            and coalesce(pm.custo_unitario, 0) > 0
          then pm.quantidade
          else 0
        end
      ),
      0
    )::numeric(14,2) as quantidade_com_custo
  from public.parque_produtos p
  left join public.parque_movimentacoes pm on pm.produto_id = p.id
  group by p.id
)
update public.parque_produtos p
set
  quantidade_atual = greatest(sp.quantidade_recalculada, 0),
  custo_medio_atual = case
    when sp.quantidade_com_custo > 0 then round((sp.custo_total_entrada / sp.quantidade_com_custo)::numeric, 2)
    else 0
  end,
  updated_at = now()
from saldo_produto sp
where sp.produto_id = p.id;
