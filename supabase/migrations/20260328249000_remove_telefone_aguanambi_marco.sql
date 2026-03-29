set search_path = public;

-- Remove lançamento indevido de TELEFONE em AGUANAMBI (março/2026)
-- em Custos das Clínicas e no vínculo correspondente no Parque.

with custos_alvo as (
  select c.id
  from public.custos_clinicas_movements c
  where c.competencia = date '2026-03-01'
    and upper(coalesce(c.clinic, '')) = 'AGUANAMBI'
    and upper(coalesce(c.product, '')) like '%TELEFONE%'
),
parque_por_custo as (
  delete from public.parque_movimentacoes pm
  using custos_alvo ca
  where pm.custo_clinica_id = ca.id
  returning pm.id
),
parque_orfao_alvo as (
  select pm.id
  from public.parque_movimentacoes pm
  join public.parque_produtos pp on pp.id = pm.produto_id
  join public.parque_itens_base ib on ib.id = pp.item_base_id
  where pm.tipo_movimentacao = 'saida_clinica'
    and extract(year from pm.data_movimentacao) = 2026
    and extract(month from pm.data_movimentacao) = 3
    and upper(coalesce(pm.destino_descricao, '')) = 'AGUANAMBI'
    and upper(coalesce(ib.nome, '')) like '%TELEFONE%'
),
parque_orfao as (
  delete from public.parque_movimentacoes pm
  using parque_orfao_alvo po
  where pm.id = po.id
  returning pm.id
),
custos_delete as (
  delete from public.custos_clinicas_movements c
  using custos_alvo ca
  where c.id = ca.id
  returning c.id
)
select
  (select count(*) from parque_por_custo) as parque_por_custo_removidos,
  (select count(*) from parque_orfao) as parque_orfao_removidos,
  (select count(*) from custos_delete) as custos_removidos;

-- Recalcula saldo/custo médio no Parque após remoção.
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
