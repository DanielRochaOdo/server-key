set search_path = public;

-- Reforço de backfill por histórico de custos com matching fuzzy de produto.
insert into public.parque_pedidos_aprovacao_origem (
  origem_chave,
  ano,
  mes,
  item,
  quantidade_referencia,
  quantidade_aprovada,
  aprovado,
  primeira_aprovacao_em,
  ultima_aprovacao_em
)
select
  public.parque_resolver_origem_chave_pedido(
    m.origem_chave,
    m.protocolo_item_id,
    m.protocolo_id,
    m.ano,
    m.mes,
    m.item,
    m.quantidade,
    m.valor_unit,
    m.valor_total_frete,
    m.setor
  ) as origem_chave,
  m.ano,
  m.mes,
  m.item,
  round(coalesce(m.quantidade, 0)::numeric, 2) as quantidade_referencia,
  least(round(coalesce(ccm.qtd, 0)::numeric, 2), round(coalesce(m.quantidade, 0)::numeric, 2)) as quantidade_aprovada,
  coalesce(ccm.qtd, 0) >= greatest(coalesce(m.quantidade, 0)::numeric - 0.01, 0) as aprovado,
  now(),
  now()
from public.pc_mensal_itens m
left join lateral (
  select coalesce(sum(cm.quantity), 0)::numeric as qtd
  from public.custos_clinicas_movements cm
  where extract(year from cm.competencia)::int = m.ano
    and extract(month from cm.competencia)::int = m.mes
    and (
      public.parque_normalizar_texto(cm.product) = public.parque_normalizar_texto(m.item)
      or public.parque_normalizar_texto(cm.product) like '%' || public.parque_normalizar_texto(m.item) || '%'
      or public.parque_normalizar_texto(m.item) like '%' || public.parque_normalizar_texto(cm.product) || '%'
    )
    and (
      coalesce(m.valor_unit, 0) = 0
      or coalesce(cm.unit_cost, 0) = 0
      or abs(coalesce(cm.unit_cost, 0) - coalesce(m.valor_unit, 0))
         <= greatest(0.01, coalesce(m.valor_unit, 0) * 0.25)
    )
) ccm on true
where m.status = 'ENTREGUE'
  and coalesce(ccm.qtd, 0) > 0
on conflict (origem_chave) do update
set
  quantidade_referencia = greatest(
    coalesce(public.parque_pedidos_aprovacao_origem.quantidade_referencia, 0),
    coalesce(excluded.quantidade_referencia, 0)
  ),
  quantidade_aprovada = greatest(
    coalesce(public.parque_pedidos_aprovacao_origem.quantidade_aprovada, 0),
    coalesce(excluded.quantidade_aprovada, 0)
  ),
  aprovado = public.parque_pedidos_aprovacao_origem.aprovado or excluded.aprovado,
  ultima_aprovacao_em = greatest(public.parque_pedidos_aprovacao_origem.ultima_aprovacao_em, excluded.ultima_aprovacao_em),
  updated_at = now();

drop function if exists public.parque_list_pedidos_entregues();

create function public.parque_list_pedidos_entregues()
returns table (
  id uuid,
  ano integer,
  mes integer,
  item text,
  loja text,
  quantidade numeric,
  quantidade_alocada numeric,
  quantidade_disponivel numeric,
  valor_unit numeric,
  valor_total_frete numeric,
  setor text,
  protocolo_id uuid,
  protocolo_item_id uuid,
  origem_label text
)
language sql
security definer
stable
as $$
  with base as (
    select
      m.id,
      m.ano,
      m.mes,
      m.item,
      coalesce(
        nullif(pi_direto.loja, ''),
        nullif(pi_match.loja, ''),
        nullif(pm_origem.loja_origem, ''),
        nullif(m.setor, ''),
        null
      ) as loja,
      coalesce(m.quantidade, 0)::numeric as quantidade,
      round(coalesce(m.valor_unit, 0)::numeric, 2) as valor_unit,
      round(coalesce(m.valor_total_frete, 0)::numeric, 2) as valor_total_frete,
      m.setor,
      m.protocolo_id,
      m.protocolo_item_id,
      m.origem_chave,
      greatest(
        round(coalesce((
          select sum(pm.quantidade)
          from public.parque_movimentacoes pm
          where pm.pedido_compra_id = m.id
            and pm.tipo_movimentacao = 'entrada_compra'
        ), 0)::numeric, 2),
        round(coalesce(pa.quantidade_aprovada, 0)::numeric, 2)
      ) as quantidade_alocada_id,
      coalesce(pa.aprovado, false) as aprovado_id
    from public.pc_mensal_itens m
    left join public.pc_protocolo_itens pi_direto
      on pi_direto.id = m.protocolo_item_id
    left join lateral (
      select pi2.loja
      from public.pc_protocolo_itens pi2
      where pi2.protocolo_id = m.protocolo_id
        and public.parque_normalizar_texto(pi2.produto) = public.parque_normalizar_texto(m.item)
      order by pi2.created_at desc
      limit 1
    ) pi_match on true
    left join lateral (
      select pm.origem_descricao as loja_origem
      from public.parque_movimentacoes pm
      where pm.pedido_compra_id = m.id
        and pm.tipo_movimentacao = 'entrada_compra'
        and coalesce(upper(trim(pm.origem_descricao)), '') not in ('', 'COMPRA')
      order by pm.data_movimentacao desc, pm.created_at desc
      limit 1
    ) pm_origem on true
    left join public.parque_pedidos_aprovacao pa
      on pa.pedido_compra_id = m.id
    where m.status = 'ENTREGUE'
  ),
  com_chave as (
    select
      b.*,
      public.parque_resolver_origem_chave_pedido(
        b.origem_chave,
        b.protocolo_item_id,
        b.protocolo_id,
        b.ano,
        b.mes,
        b.item,
        b.quantidade,
        b.valor_unit,
        b.valor_total_frete,
        b.setor
      ) as origem_chave_resolvida
    from base b
  ),
  enriquecido as (
    select
      c.id,
      c.ano,
      c.mes,
      c.item,
      c.loja,
      c.quantidade,
      c.valor_unit,
      c.valor_total_frete,
      c.setor,
      c.protocolo_id,
      c.protocolo_item_id,
      c.quantidade_alocada_id,
      c.aprovado_id,
      round(coalesce(pao.quantidade_aprovada, 0)::numeric, 2) as quantidade_alocada_origem,
      coalesce(pao.aprovado, false) as aprovado_origem,
      round(coalesce(ccm.qtd, 0)::numeric, 2) as quantidade_alocada_custos
    from com_chave c
    left join public.parque_pedidos_aprovacao_origem pao
      on pao.origem_chave = c.origem_chave_resolvida
    left join lateral (
      select coalesce(sum(cm.quantity), 0)::numeric as qtd
      from public.custos_clinicas_movements cm
      where extract(year from cm.competencia)::int = c.ano
        and extract(month from cm.competencia)::int = c.mes
        and (
          public.parque_normalizar_texto(cm.product) = public.parque_normalizar_texto(c.item)
          or public.parque_normalizar_texto(cm.product) like '%' || public.parque_normalizar_texto(c.item) || '%'
          or public.parque_normalizar_texto(c.item) like '%' || public.parque_normalizar_texto(cm.product) || '%'
        )
        and (
          coalesce(c.valor_unit, 0) = 0
          or coalesce(cm.unit_cost, 0) = 0
          or abs(coalesce(cm.unit_cost, 0) - coalesce(c.valor_unit, 0))
             <= greatest(0.01, coalesce(c.valor_unit, 0) * 0.25)
        )
    ) ccm on true
  ),
  final as (
    select
      e.*,
      greatest(
        e.quantidade_alocada_id,
        e.quantidade_alocada_origem,
        e.quantidade_alocada_custos
      )::numeric as quantidade_alocada_final
    from enriquecido e
  )
  select
    f.id,
    f.ano,
    f.mes,
    f.item,
    f.loja,
    f.quantidade,
    f.quantidade_alocada_final as quantidade_alocada,
    greatest(round((f.quantidade - f.quantidade_alocada_final)::numeric, 2), 0)::numeric as quantidade_disponivel,
    f.valor_unit,
    f.valor_total_frete,
    f.setor,
    f.protocolo_id,
    f.protocolo_item_id,
    concat_ws(' • ',
      concat(lpad(f.mes::text, 2, '0'), '/', f.ano::text),
      f.item,
      concat('Qtd ', trim(to_char(f.quantidade, 'FM999999990.00'))),
      concat('Saldo ', trim(to_char(greatest(round((f.quantidade - f.quantidade_alocada_final)::numeric, 2), 0), 'FM999999990.00'))),
      nullif(upper(coalesce(f.loja, '')), '')
    ) as origem_label
  from final f
  where not (
    f.aprovado_id
    or f.aprovado_origem
    or f.quantidade_alocada_final >= greatest(f.quantidade - 0.01, 0)
  )
    and greatest(round((f.quantidade - f.quantidade_alocada_final)::numeric, 2), 0) > 0.01
  order by f.ano desc, f.mes desc, f.id desc;
$$;

grant execute on function public.parque_list_pedidos_entregues() to authenticated;
