set search_path = public;

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
      public.parque_normalizar_texto(m.item) as item_normalizado,
      coalesce(
        nullif(pi_direto.loja, ''),
        nullif(pi_match.loja, ''),
        nullif(pm_origem.loja_origem, ''),
        nullif(m.setor, ''),
        null
      ) as loja,
      coalesce(m.quantidade, 0)::numeric as quantidade,
      greatest(
        round(coalesce((
          select sum(pm.quantidade)
          from public.parque_movimentacoes pm
          where pm.pedido_compra_id = m.id
            and pm.tipo_movimentacao = 'entrada_compra'
        ), 0)::numeric, 2),
        round(coalesce(pa.quantidade_aprovada, 0)::numeric, 2)
      ) as quantidade_alocada_base,
      coalesce(pa.aprovado, false) as aprovado_base,
      coalesce(m.valor_unit, 0)::numeric as valor_unit,
      coalesce(m.valor_total_frete, 0)::numeric as valor_total_frete,
      m.setor,
      m.protocolo_id,
      m.protocolo_item_id
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
  aprovacao_relacionada as (
    select
      b.id as pedido_id,
      coalesce(max(pa2.quantidade_aprovada), 0)::numeric as quantidade_aprovada_relacionada,
      coalesce(bool_or(pa2.aprovado), false) as aprovado_relacionado
    from base b
    left join public.pc_mensal_itens m2
      on m2.status = 'ENTREGUE'
     and m2.id <> b.id
     and (
       (b.protocolo_item_id is not null and m2.protocolo_item_id = b.protocolo_item_id)
       or (
         b.protocolo_item_id is null
         and coalesce(m2.protocolo_id::text, '') = coalesce(b.protocolo_id::text, '')
         and m2.ano = b.ano
         and m2.mes = b.mes
         and public.parque_normalizar_texto(m2.item) = b.item_normalizado
         and abs(coalesce(m2.quantidade, 0)::numeric - b.quantidade) <= 0.01
         and abs(coalesce(m2.valor_unit, 0)::numeric - b.valor_unit) <= 0.01
         and abs(coalesce(m2.valor_total_frete, 0)::numeric - b.valor_total_frete) <= 0.01
       )
     )
    left join public.parque_pedidos_aprovacao pa2
      on pa2.pedido_compra_id = m2.id
     and pa2.aprovado = true
    group by b.id
  ),
  enriquecido as (
    select
      b.id,
      b.ano,
      b.mes,
      b.item,
      b.loja,
      b.quantidade,
      greatest(
        b.quantidade_alocada_base,
        round(coalesce(ar.quantidade_aprovada_relacionada, 0)::numeric, 2)
      )::numeric as quantidade_alocada,
      b.valor_unit,
      b.valor_total_frete,
      b.setor,
      b.protocolo_id,
      b.protocolo_item_id,
      (
        b.aprovado_base
        or coalesce(ar.aprovado_relacionado, false)
        or greatest(
          b.quantidade_alocada_base,
          round(coalesce(ar.quantidade_aprovada_relacionada, 0)::numeric, 2)
        ) >= greatest(b.quantidade - 0.01, 0)
      ) as aprovado_final
    from base b
    left join aprovacao_relacionada ar
      on ar.pedido_id = b.id
  )
  select
    e.id,
    e.ano,
    e.mes,
    e.item,
    e.loja,
    e.quantidade,
    e.quantidade_alocada,
    greatest(round((e.quantidade - e.quantidade_alocada)::numeric, 2), 0)::numeric as quantidade_disponivel,
    e.valor_unit,
    e.valor_total_frete,
    e.setor,
    e.protocolo_id,
    e.protocolo_item_id,
    concat_ws(' • ',
      concat(lpad(e.mes::text, 2, '0'), '/', e.ano::text),
      e.item,
      concat('Qtd ', trim(to_char(e.quantidade, 'FM999999990.00'))),
      concat('Saldo ', trim(to_char(greatest(round((e.quantidade - e.quantidade_alocada)::numeric, 2), 0), 'FM999999990.00'))),
      nullif(upper(coalesce(e.loja, '')), '')
    ) as origem_label
  from enriquecido e
  where e.aprovado_final = false
    and greatest(round((e.quantidade - e.quantidade_alocada)::numeric, 2), 0) > 0.01
  order by e.ano desc, e.mes desc, e.id desc;
$$;

grant execute on function public.parque_list_pedidos_entregues() to authenticated;
