set search_path = public;

create extension if not exists unaccent;

create or replace function public.parque_normalizar_texto(p_texto text)
returns text
language sql
stable
as $$
  select regexp_replace(
    upper(trim(unaccent(coalesce(p_texto, '')))),
    '\s+',
    ' ',
    'g'
  );
$$;

with movimentos as (
  select
    pm.id as movimentacao_id,
    pm.produto_id as produto_atual_id,
    mi.item as pedido_item,
    public.parque_normalizar_texto(mi.item) as pedido_item_norm
  from public.parque_movimentacoes pm
  join public.pc_mensal_itens mi on mi.id = pm.pedido_compra_id
  where pm.tipo_movimentacao = 'entrada_compra'
    and pm.pedido_compra_id is not null
),
candidatos as (
  select
    m.movimentacao_id,
    p.id as produto_id,
    (
      case
        when public.parque_normalizar_texto(public.parque_produto_label(p.id)) = m.pedido_item_norm then 100
        else 0
      end
      +
      case
        when m.pedido_item_norm like '%' || public.parque_normalizar_texto(ib.nome) || '%' then 25
        else 0
      end
      +
      case
        when coalesce(nullif(public.parque_normalizar_texto(p.especificacao_valor), ''), '') <> ''
             and m.pedido_item_norm like '%' || public.parque_normalizar_texto(p.especificacao_valor) || '%'
        then 50
        else 0
      end
    ) as score
  from movimentos m
  join public.parque_produtos p on true
  join public.parque_itens_base ib on ib.id = p.item_base_id
  where m.pedido_item_norm like '%' || public.parque_normalizar_texto(ib.nome) || '%'
),
best_match as (
  select movimentacao_id, produto_id
  from (
    select
      c.*,
      row_number() over (
        partition by c.movimentacao_id
        order by c.score desc, c.produto_id
      ) as rn
    from candidatos c
    where c.score > 0
  ) ranked
  where rn = 1
)
update public.parque_movimentacoes pm
set produto_id = bm.produto_id
from best_match bm
where pm.id = bm.movimentacao_id
  and pm.produto_id is distinct from bm.produto_id;

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
