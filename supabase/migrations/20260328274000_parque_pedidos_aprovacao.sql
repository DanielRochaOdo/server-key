set search_path = public;

create table if not exists public.parque_pedidos_aprovacao (
  pedido_compra_id uuid primary key references public.pc_mensal_itens(id) on delete cascade,
  quantidade_aprovada numeric(14,2) not null default 0,
  aprovado boolean not null default false,
  primeira_aprovacao_em timestamptz not null default now(),
  ultima_aprovacao_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists parque_pedidos_aprovacao_aprovado_idx
  on public.parque_pedidos_aprovacao (aprovado);

drop trigger if exists trg_parque_pedidos_aprovacao_updated_at on public.parque_pedidos_aprovacao;
create trigger trg_parque_pedidos_aprovacao_updated_at
before update on public.parque_pedidos_aprovacao
for each row execute function public.parque_set_updated_at();

create or replace function public.parque_registrar_aprovacao_pedido(
  p_pedido_compra_id uuid,
  p_quantidade numeric
)
returns void
language plpgsql
security definer
as $$
declare
  v_quantidade_pedido numeric(14,2);
  v_nova_quantidade_aprovada numeric(14,2);
  v_tolerancia numeric(14,2) := 0.01;
begin
  if p_pedido_compra_id is null or coalesce(p_quantidade, 0) <= 0 then
    return;
  end if;

  select coalesce(mi.quantidade, 0)::numeric(14,2)
    into v_quantidade_pedido
  from public.pc_mensal_itens mi
  where mi.id = p_pedido_compra_id;

  if not found then
    return;
  end if;

  insert into public.parque_pedidos_aprovacao (
    pedido_compra_id,
    quantidade_aprovada,
    aprovado,
    primeira_aprovacao_em,
    ultima_aprovacao_em
  )
  values (
    p_pedido_compra_id,
    round(coalesce(p_quantidade, 0)::numeric, 2),
    round(coalesce(p_quantidade, 0)::numeric, 2) >= greatest(v_quantidade_pedido - v_tolerancia, 0),
    now(),
    now()
  )
  on conflict (pedido_compra_id) do update
  set
    quantidade_aprovada = round(public.parque_pedidos_aprovacao.quantidade_aprovada + coalesce(excluded.quantidade_aprovada, 0), 2),
    aprovado = (
      round(public.parque_pedidos_aprovacao.quantidade_aprovada + coalesce(excluded.quantidade_aprovada, 0), 2)
      >= greatest(v_quantidade_pedido - v_tolerancia, 0)
    ) or public.parque_pedidos_aprovacao.aprovado,
    ultima_aprovacao_em = now(),
    updated_at = now();

  select quantidade_aprovada
    into v_nova_quantidade_aprovada
  from public.parque_pedidos_aprovacao
  where pedido_compra_id = p_pedido_compra_id;

  if v_nova_quantidade_aprovada is not null and v_nova_quantidade_aprovada > v_quantidade_pedido then
    update public.parque_pedidos_aprovacao
    set quantidade_aprovada = v_quantidade_pedido,
        aprovado = true,
        updated_at = now()
    where pedido_compra_id = p_pedido_compra_id;
  end if;
end;
$$;

create or replace function public.parque_after_insert_aprovacao_pedido()
returns trigger
language plpgsql
as $$
begin
  if new.tipo_movimentacao = 'entrada_compra' and new.pedido_compra_id is not null then
    perform public.parque_registrar_aprovacao_pedido(new.pedido_compra_id, new.quantidade);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_parque_after_insert_aprovacao_pedido on public.parque_movimentacoes;
create trigger trg_parque_after_insert_aprovacao_pedido
after insert on public.parque_movimentacoes
for each row execute function public.parque_after_insert_aprovacao_pedido();

insert into public.parque_pedidos_aprovacao (
  pedido_compra_id,
  quantidade_aprovada,
  aprovado,
  primeira_aprovacao_em,
  ultima_aprovacao_em
)
select
  pm.pedido_compra_id,
  round(sum(pm.quantidade)::numeric, 2) as quantidade_aprovada,
  round(sum(pm.quantidade)::numeric, 2) >= greatest(coalesce(mi.quantidade, 0)::numeric - 0.01, 0) as aprovado,
  min(coalesce(pm.data_movimentacao, pm.created_at, now())) as primeira_aprovacao_em,
  max(coalesce(pm.data_movimentacao, pm.created_at, now())) as ultima_aprovacao_em
from public.parque_movimentacoes pm
join public.pc_mensal_itens mi
  on mi.id = pm.pedido_compra_id
where pm.tipo_movimentacao = 'entrada_compra'
  and pm.pedido_compra_id is not null
group by pm.pedido_compra_id, mi.quantidade
on conflict (pedido_compra_id) do update
set
  quantidade_aprovada = greatest(public.parque_pedidos_aprovacao.quantidade_aprovada, excluded.quantidade_aprovada),
  aprovado = public.parque_pedidos_aprovacao.aprovado or excluded.aprovado,
  ultima_aprovacao_em = greatest(public.parque_pedidos_aprovacao.ultima_aprovacao_em, excluded.ultima_aprovacao_em),
  updated_at = now();

create or replace function public.parque_delete_produto(
  p_produto_id uuid
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_deleted_id uuid;
  v_row record;
begin
  if has_module_edit_access('parque_tecnologico') is not true then
    raise exception 'Sem permissão para excluir produtos do Parque Tecnológico.';
  end if;

  if p_produto_id is null then
    raise exception 'Produto inválido.';
  end if;

  for v_row in
    select pm.pedido_compra_id, sum(pm.quantidade)::numeric as quantidade
    from public.parque_movimentacoes pm
    where pm.produto_id = p_produto_id
      and pm.tipo_movimentacao = 'entrada_compra'
      and pm.pedido_compra_id is not null
    group by pm.pedido_compra_id
  loop
    perform public.parque_registrar_aprovacao_pedido(v_row.pedido_compra_id, v_row.quantidade);
  end loop;

  delete from public.parque_descartes
  where produto_id = p_produto_id;

  delete from public.parque_movimentacoes
  where produto_id = p_produto_id;

  delete from public.parque_produtos
  where id = p_produto_id
  returning id into v_deleted_id;

  if v_deleted_id is null then
    raise exception 'Produto não encontrado para exclusão.';
  end if;

  return v_deleted_id;
end;
$$;

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
      greatest(
        round(coalesce((
          select sum(pm.quantidade)
          from public.parque_movimentacoes pm
          where pm.pedido_compra_id = m.id
            and pm.tipo_movimentacao = 'entrada_compra'
        ), 0)::numeric, 2),
        round(coalesce(pa.quantidade_aprovada, 0)::numeric, 2)
      ) as quantidade_alocada,
      coalesce(pa.aprovado, false) as aprovado,
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
    left join public.parque_pedidos_aprovacao pa
      on pa.pedido_compra_id = m.id
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
    greatest(round((b.quantidade - b.quantidade_alocada)::numeric, 2), 0)::numeric as quantidade_disponivel,
    b.valor_unit,
    b.valor_total_frete,
    b.setor,
    b.protocolo_id,
    b.protocolo_item_id,
    concat_ws(' • ',
      concat(lpad(b.mes::text, 2, '0'), '/', b.ano::text),
      b.item,
      concat('Qtd ', trim(to_char(b.quantidade, 'FM999999990.00'))),
      concat('Saldo ', trim(to_char(greatest(round((b.quantidade - b.quantidade_alocada)::numeric, 2), 0), 'FM999999990.00'))),
      nullif(upper(coalesce(b.loja, '')), '')
    ) as origem_label
  from base b
  where b.aprovado = false
    and greatest(round((b.quantidade - b.quantidade_alocada)::numeric, 2), 0) > 0.01
  order by b.ano desc, b.mes desc, b.id desc;
$$;

grant select, insert, update, delete on public.parque_pedidos_aprovacao to authenticated;
grant execute on function public.parque_registrar_aprovacao_pedido(uuid, numeric) to authenticated;
grant execute on function public.parque_after_insert_aprovacao_pedido() to authenticated;
grant execute on function public.parque_delete_produto(uuid) to authenticated;
grant execute on function public.parque_list_pedidos_entregues() to authenticated;
