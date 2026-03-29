set search_path = public;

create or replace function public.parque_is_destino_estoque(
  p_destino_tipo text,
  p_destino_descricao text
)
returns boolean
language sql
immutable
as $$
  select
    coalesce(lower(trim(p_destino_tipo)), '') = 'estoque'
    or upper(trim(coalesce(p_destino_descricao, ''))) in ('PARQUE TECNOLOGICO', 'PARQUE TECNOLÓGICO', 'ESTOQUE');
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

create or replace function public.parque_after_insert_movimentacao()
returns trigger
language plpgsql
as $$
declare
  produto_row public.parque_produtos%rowtype;
  next_quantity numeric(14,2);
  next_cost numeric(14,2);
  total_cost_acc numeric(14,2);
  clinic_movement_id uuid;
  clinic_label text;
  delta_sign integer;
begin
  select * into produto_row
  from public.parque_produtos
  where id = new.produto_id
  for update;

  delta_sign := public.parque_movimentacao_delta(
    new.tipo_movimentacao,
    new.destino_tipo,
    new.destino_descricao
  );

  if delta_sign = 1 then
    next_quantity := coalesce(produto_row.quantidade_atual, 0) + new.quantidade;
    if coalesce(new.custo_unitario, 0) > 0 then
      total_cost_acc :=
        (coalesce(produto_row.quantidade_atual, 0) * coalesce(produto_row.custo_medio_atual, 0))
        + (new.quantidade * new.custo_unitario);
      next_cost := case when next_quantity > 0 then round((total_cost_acc / next_quantity)::numeric, 2) else 0 end;
    else
      next_cost := coalesce(produto_row.custo_medio_atual, 0);
    end if;
  else
    next_quantity := coalesce(produto_row.quantidade_atual, 0) - new.quantidade;
    if next_quantity < 0 then
      raise exception 'Saldo negativo não permitido.';
    end if;
    next_cost := coalesce(produto_row.custo_medio_atual, 0);
  end if;

  update public.parque_produtos
  set quantidade_atual = next_quantity,
      custo_medio_atual = next_cost,
      updated_at = now()
  where id = new.produto_id;

  if new.tipo_movimentacao = 'saida_clinica' then
    clinic_label := coalesce(new.destino_descricao, 'Clinica');
    insert into public.custos_clinicas_movements (
      competencia,
      clinic,
      product,
      store,
      quantity,
      unit_cost,
      total_cost,
      created_by,
      created_at
    ) values (
      date_trunc('month', new.data_movimentacao)::date,
      clinic_label,
      coalesce(public.parque_produto_label(new.produto_id), 'Produto'),
      coalesce(nullif(new.origem_descricao, ''), 'PARQUE TECNOLOGICO'),
      round(new.quantidade)::integer,
      coalesce(new.custo_unitario, 0),
      round((new.quantidade * coalesce(new.custo_unitario, 0))::numeric, 2),
      new.created_by,
      now()
    ) returning id into clinic_movement_id;

    update public.parque_movimentacoes
    set custo_clinica_id = clinic_movement_id
    where id = new.id;
  end if;

  return null;
end;
$$;

grant execute on function public.parque_is_destino_estoque(text, text) to authenticated;
grant execute on function public.parque_movimentacao_delta(text, text, text) to authenticated;

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
