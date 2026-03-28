set search_path = public;

-- Corrige saldo inflado no estoque:
-- para entradas de compra de jan/fev já com destino identificado,
-- cria a saída clínica correspondente no Parque (sem disparar novo custo_clinicas_movements)
-- e recalcula saldo final dos produtos.

alter table public.parque_movimentacoes disable trigger trg_parque_before_insert_movimentacao;
alter table public.parque_movimentacoes disable trigger trg_parque_after_insert_movimentacao;

with entradas_base as (
  select
    e.id as entrada_id,
    e.produto_id,
    e.pedido_compra_id,
    e.quantidade,
    e.custo_unitario,
    e.data_movimentacao,
    e.origem_descricao,
    e.observacao,
    m.ano,
    m.mes,
    m.setor,
    upper(
      trim(
        regexp_replace(
          coalesce(e.observacao, ''),
          '^.*DESTINO IDENTIFICADO AUTOMATICAMENTE:\\s*',
          '',
          'i'
        )
      )
    ) as destino_observacao
  from public.parque_movimentacoes e
  join public.pc_mensal_itens m
    on m.id = e.pedido_compra_id
  where e.tipo_movimentacao = 'entrada_compra'
    and m.ano = extract(year from current_date)::int
    and m.mes in (1, 2)
    and (
      coalesce(e.observacao, '') ilike '%DESTINO IDENTIFICADO AUTOMATICAMENTE:%'
      or coalesce(m.setor, '') <> ''
    )
    and not exists (
      select 1
      from public.parque_movimentacoes s
      where s.tipo_movimentacao = 'saida_clinica'
        and s.produto_id = e.produto_id
        and s.pedido_compra_id = e.pedido_compra_id
    )
),
entradas_resolvidas as (
  select
    eb.*,
    coalesce(
      public.parque_normalize_clinic_key(nullif(eb.destino_observacao, '')),
      public.parque_normalize_clinic_key(eb.setor),
      'MATRIZ'
    ) as destino_clinica
  from entradas_base eb
),
insert_saidas as (
  insert into public.parque_movimentacoes (
    produto_id,
    tipo_movimentacao,
    origem_tipo,
    origem_id,
    origem_descricao,
    destino_tipo,
    destino_id,
    destino_descricao,
    quantidade,
    custo_unitario,
    data_movimentacao,
    observacao,
    pedido_compra_id,
    custo_clinica_id,
    created_by,
    created_at
  )
  select
    er.produto_id,
    'saida_clinica',
    'estoque',
    null,
    coalesce(nullif(er.origem_descricao, ''), 'PARQUE TECNOLOGICO'),
    'clinica',
    null,
    er.destino_clinica,
    er.quantidade,
    er.custo_unitario,
    er.data_movimentacao,
    'BAIXA HISTORICA AUTOMATICA JAN/FEV',
    er.pedido_compra_id,
    null,
    null,
    coalesce(er.data_movimentacao, now())
  from entradas_resolvidas er
  returning id
)
select count(*) from insert_saidas;

alter table public.parque_movimentacoes enable trigger trg_parque_before_insert_movimentacao;
alter table public.parque_movimentacoes enable trigger trg_parque_after_insert_movimentacao;

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
