set search_path = public;

-- 1) Normaliza destino textual de Parque/Estoque para destino_tipo='estoque'
with movs as (
  select
    id,
    regexp_replace(
      translate(
        upper(coalesce(destino_descricao, '')),
        'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
        'AAAAAEEEEIIIIOOOOOUUUUC'
      ),
      '\s+',
      ' ',
      'g'
    ) as destino_norm
  from public.parque_movimentacoes
)
update public.parque_movimentacoes pm
set destino_tipo = 'estoque'
from movs m
where pm.id = m.id
  and (
    m.destino_norm like '%PARQUE%TECNOLOG%'
    or m.destino_norm like '%ESTOQUE%'
  )
  and coalesce(pm.destino_tipo, '') <> 'estoque';

-- 2) Detecção robusta para destino de estoque (inclui variações de texto)
create or replace function public.parque_is_destino_estoque(
  p_destino_tipo text,
  p_destino_descricao text
)
returns boolean
language sql
immutable
as $$
  with norm as (
    select regexp_replace(
      translate(
        upper(coalesce(p_destino_descricao, '')),
        'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
        'AAAAAEEEEIIIIOOOOOUUUUC'
      ),
      '\s+',
      ' ',
      'g'
    ) as destino_norm
  )
  select
    coalesce(lower(trim(p_destino_tipo)), '') = 'estoque'
    or (select destino_norm from norm) like '%PARQUE%TECNOLOG%'
    or (select destino_norm from norm) like '%ESTOQUE%';
$$;

create or replace function public.parque_movimentacao_delta(
  p_tipo_movimentacao text,
  p_destino_tipo text,
  p_destino_descricao text
)
returns integer
language sql
immutable
as $$
  select case
    when public.parque_is_destino_estoque(p_destino_tipo, p_destino_descricao) then 1
    when p_tipo_movimentacao in ('entrada_manual', 'entrada_compra', 'ajuste_positivo') then 1
    else -1
  end;
$$;

grant execute on function public.parque_is_destino_estoque(text, text) to authenticated;
grant execute on function public.parque_movimentacao_delta(text, text, text) to authenticated;

-- 3) Recalcula saldo/custo médio de todos os produtos com a regra consolidada
with saldo_produto as (
  select
    p.id as produto_id,
    coalesce(
      sum(
        case
          when public.parque_movimentacao_delta(pm.tipo_movimentacao, pm.destino_tipo, pm.destino_descricao) = 1
            then pm.quantidade
          else -pm.quantidade
        end
      ),
      0
    )::numeric(14,2) as quantidade_recalculada,
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
    )::numeric(14,2) as custo_total_entrada,
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
