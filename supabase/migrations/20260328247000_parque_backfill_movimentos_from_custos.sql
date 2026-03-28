set search_path = public;

-- Backfill histórico do Parque com base no já registrado em custos_clinicas_movements.
-- Estratégia:
-- 1) Garante item/produto base no Parque para cada produto dos custos.
-- 2) Para cada linha de custos ainda não vinculada a uma saída do Parque:
--    - cria uma entrada técnica (backfill) na mesma data (menos 1s)
--    - cria a saída para clínica com custo_clinica_id apontando para a linha original
-- 3) Recalcula saldo/custo médio de todos os produtos.
--
-- Observação:
-- Triggers de movimentação são desativadas durante o backfill para evitar
-- duplicação de custos_clinicas_movements no gatilho de saída clínica.

alter table public.parque_movimentacoes disable trigger trg_parque_before_insert_movimentacao;
alter table public.parque_movimentacoes disable trigger trg_parque_after_insert_movimentacao;

do $$
declare
  row_cost record;
  v_item_nome text;
  v_item_id uuid;
  v_produto_id uuid;
  v_data_mov timestamptz;
  v_qtd numeric(14,2);
  v_unit_cost numeric(14,2);
begin
  for row_cost in
    select
      c.id,
      c.product,
      c.store,
      c.clinic,
      coalesce(c.quantity, 0)::numeric(14,2) as quantity,
      coalesce(
        c.unit_cost,
        case when coalesce(c.quantity, 0) > 0 then (coalesce(c.total_cost, 0) / c.quantity) else 0 end
      )::numeric(14,2) as unit_cost,
      c.created_at,
      c.competencia
    from public.custos_clinicas_movements c
    where coalesce(c.quantity, 0) > 0
      and coalesce(nullif(btrim(c.product), ''), '') <> ''
    order by c.created_at asc, c.id asc
  loop
    if exists (
      select 1
      from public.parque_movimentacoes pm
      where pm.custo_clinica_id = row_cost.id
        and pm.tipo_movimentacao = 'saida_clinica'
    ) then
      continue;
    end if;

    v_item_nome := upper(btrim(row_cost.product));
    v_qtd := greatest(coalesce(row_cost.quantity, 0), 0);
    v_unit_cost := greatest(coalesce(row_cost.unit_cost, 0), 0);
    v_data_mov := coalesce(
      row_cost.created_at,
      (row_cost.competencia::timestamptz + interval '12 hour')
    );

    if v_qtd <= 0 then
      continue;
    end if;

    insert into public.parque_itens_base (nome, ativo)
    select v_item_nome, true
    where not exists (
      select 1
      from public.parque_itens_base ib
      where upper(btrim(ib.nome)) = v_item_nome
    );

    select ib.id
      into v_item_id
    from public.parque_itens_base ib
    where upper(btrim(ib.nome)) = v_item_nome
    order by ib.created_at asc
    limit 1;

    select p.id
      into v_produto_id
    from public.parque_produtos p
    where p.item_base_id = v_item_id
      and upper(coalesce(btrim(p.categoria), '')) = 'TECNOLOGIA'
      and coalesce(btrim(p.especificacao_valor), '') = ''
      and p.unidade_base_id is null
      and p.marca_base_id is null
    order by p.created_at asc
    limit 1;

    if v_produto_id is null then
      insert into public.parque_produtos (
        item_base_id,
        categoria,
        especificacao_valor,
        unidade_base_id,
        marca_base_id,
        quantidade_atual,
        quantidade_minima,
        custo_medio_atual,
        ativo,
        created_by
      ) values (
        v_item_id,
        'TECNOLOGIA',
        null,
        null,
        null,
        0,
        null,
        0,
        true,
        null
      ) returning id into v_produto_id;
    end if;

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
    ) values (
      v_produto_id,
      'entrada_manual',
      'estoque',
      null,
      'BACKFILL CUSTOS CLINICAS',
      'estoque',
      null,
      'PARQUE TECNOLOGICO',
      v_qtd,
      v_unit_cost,
      (v_data_mov - interval '1 second'),
      concat('BACKFILL CUSTOS CLINICAS ENTRADA: ', row_cost.id::text),
      null,
      row_cost.id,
      null,
      (v_data_mov - interval '1 second')
    );

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
    ) values (
      v_produto_id,
      'saida_clinica',
      'estoque',
      null,
      upper(coalesce(nullif(btrim(row_cost.store), ''), 'PARQUE TECNOLOGICO')),
      'clinica',
      null,
      upper(coalesce(nullif(btrim(row_cost.clinic), ''), 'MATRIZ')),
      v_qtd,
      v_unit_cost,
      v_data_mov,
      concat('BACKFILL CUSTOS CLINICAS SAIDA: ', row_cost.id::text),
      null,
      row_cost.id,
      null,
      v_data_mov
    );
  end loop;
end;
$$;

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
