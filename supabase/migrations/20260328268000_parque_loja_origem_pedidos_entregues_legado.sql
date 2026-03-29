set search_path = public;

with pedido_loja as (
  select
    m.id as pedido_id,
    upper(
      coalesce(
        nullif(trim(pi_direto.loja), ''),
        nullif(trim(pi_match.loja), ''),
        nullif(trim(m.setor), ''),
        ''
      )
    ) as loja_origem
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
  where m.status = 'ENTREGUE'
)
update public.parque_movimentacoes pm
set
  origem_tipo = 'compra',
  origem_descricao = pl.loja_origem
from pedido_loja pl
where pm.pedido_compra_id = pl.pedido_id
  and pl.loja_origem <> ''
  and (
    coalesce(pm.origem_tipo, '') <> 'compra'
    or coalesce(upper(trim(pm.origem_descricao)), '') in ('', 'COMPRA')
    or coalesce(upper(trim(pm.origem_descricao)), '') <> pl.loja_origem
  );

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
      coalesce((
        select sum(pm.quantidade)
        from public.parque_movimentacoes pm
        where pm.pedido_compra_id = m.id
          and pm.tipo_movimentacao = 'entrada_compra'
      ), 0)::numeric as quantidade_alocada,
      m.valor_unit,
      m.valor_total_frete,
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
    where m.status = 'ENTREGUE'
  )
  select
    b.id,
    b.ano,
    b.mes,
    b.item,
    b.loja,
    b.quantidade,
    b.quantidade_alocada,
    greatest((b.quantidade - b.quantidade_alocada), 0)::numeric as quantidade_disponivel,
    b.valor_unit,
    b.valor_total_frete,
    b.setor,
    b.protocolo_id,
    b.protocolo_item_id,
    concat_ws(' • ',
      concat(lpad(b.mes::text, 2, '0'), '/', b.ano::text),
      b.item,
      concat('Qtd ', trim(to_char(b.quantidade, 'FM999999990.00'))),
      concat('Saldo ', trim(to_char(greatest((b.quantidade - b.quantidade_alocada), 0), 'FM999999990.00'))),
      nullif(upper(coalesce(b.loja, '')), '')
    ) as origem_label
  from base b
  where greatest((b.quantidade - b.quantidade_alocada), 0) > 0
  order by b.ano desc, b.mes desc, b.id desc;
$$;

grant execute on function public.parque_list_pedidos_entregues() to authenticated;
