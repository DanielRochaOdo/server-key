set search_path = public;

create or replace function public.parque_resolver_origem_chave_pedido(
  p_origem_chave text,
  p_protocolo_item_id uuid,
  p_protocolo_id uuid,
  p_ano integer,
  p_mes integer,
  p_item text,
  p_quantidade numeric,
  p_valor_unit numeric,
  p_valor_total_frete numeric,
  p_setor text
)
returns text
language sql
stable
as $$
  select coalesce(
    nullif(trim(p_origem_chave), ''),
    case when p_protocolo_item_id is not null then p_protocolo_item_id::text else null end,
    concat_ws(
      '|',
      coalesce(p_protocolo_id::text, ''),
      coalesce(p_ano::text, ''),
      coalesce(lpad(p_mes::text, 2, '0'), ''),
      coalesce(public.parque_normalizar_texto(p_item), ''),
      trim(to_char(coalesce(round(p_quantidade::numeric, 2), 0), 'FM999999990.00')),
      trim(to_char(coalesce(round(p_valor_unit::numeric, 2), 0), 'FM999999990.00')),
      trim(to_char(coalesce(round(p_valor_total_frete::numeric, 2), 0), 'FM999999990.00')),
      coalesce(public.parque_normalizar_texto(p_setor), '')
    )
  );
$$;

create table if not exists public.parque_pedidos_aprovacao_origem (
  origem_chave text primary key,
  ano integer null,
  mes integer null,
  item text null,
  loja text null,
  quantidade_referencia numeric(14,2) not null default 0,
  quantidade_aprovada numeric(14,2) not null default 0,
  aprovado boolean not null default false,
  primeira_aprovacao_em timestamptz not null default now(),
  ultima_aprovacao_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists parque_pedidos_aprovacao_origem_aprovado_idx
  on public.parque_pedidos_aprovacao_origem (aprovado);

drop trigger if exists trg_parque_pedidos_aprovacao_origem_updated_at on public.parque_pedidos_aprovacao_origem;
create trigger trg_parque_pedidos_aprovacao_origem_updated_at
before update on public.parque_pedidos_aprovacao_origem
for each row execute function public.parque_set_updated_at();

create or replace function public.parque_registrar_aprovacao_pedido_origem(
  p_pedido_compra_id uuid,
  p_quantidade numeric
)
returns void
language plpgsql
security definer
as $$
declare
  v_mensal public.pc_mensal_itens%rowtype;
  v_loja text;
  v_origem_chave text;
  v_qtd_ref numeric(14,2);
  v_tolerancia numeric(14,2) := 0.01;
begin
  if p_pedido_compra_id is null or coalesce(p_quantidade, 0) <= 0 then
    return;
  end if;

  select *
    into v_mensal
  from public.pc_mensal_itens
  where id = p_pedido_compra_id;

  if not found then
    return;
  end if;

  select coalesce(
           nullif(pi_direto.loja, ''),
           nullif(pi_match.loja, ''),
           nullif(v_mensal.setor, ''),
           null
         )
    into v_loja
  from (select 1) as dummy
  left join public.pc_protocolo_itens pi_direto
    on pi_direto.id = v_mensal.protocolo_item_id
  left join lateral (
    select pi2.loja
    from public.pc_protocolo_itens pi2
    where pi2.protocolo_id = v_mensal.protocolo_id
      and public.parque_normalizar_texto(pi2.produto) = public.parque_normalizar_texto(v_mensal.item)
    order by pi2.created_at desc
    limit 1
  ) pi_match on true;

  v_origem_chave := public.parque_resolver_origem_chave_pedido(
    v_mensal.origem_chave,
    v_mensal.protocolo_item_id,
    v_mensal.protocolo_id,
    v_mensal.ano,
    v_mensal.mes,
    v_mensal.item,
    v_mensal.quantidade,
    v_mensal.valor_unit,
    v_mensal.valor_total_frete,
    v_mensal.setor
  );

  if v_origem_chave is null or btrim(v_origem_chave) = '' then
    return;
  end if;

  v_qtd_ref := round(coalesce(v_mensal.quantidade, 0)::numeric, 2);

  insert into public.parque_pedidos_aprovacao_origem (
    origem_chave,
    ano,
    mes,
    item,
    loja,
    quantidade_referencia,
    quantidade_aprovada,
    aprovado,
    primeira_aprovacao_em,
    ultima_aprovacao_em
  )
  values (
    v_origem_chave,
    v_mensal.ano,
    v_mensal.mes,
    v_mensal.item,
    v_loja,
    v_qtd_ref,
    round(coalesce(p_quantidade, 0)::numeric, 2),
    round(coalesce(p_quantidade, 0)::numeric, 2) >= greatest(v_qtd_ref - v_tolerancia, 0),
    now(),
    now()
  )
  on conflict (origem_chave) do update
  set
    ano = coalesce(excluded.ano, public.parque_pedidos_aprovacao_origem.ano),
    mes = coalesce(excluded.mes, public.parque_pedidos_aprovacao_origem.mes),
    item = coalesce(excluded.item, public.parque_pedidos_aprovacao_origem.item),
    loja = coalesce(excluded.loja, public.parque_pedidos_aprovacao_origem.loja),
    quantidade_referencia = greatest(
      coalesce(public.parque_pedidos_aprovacao_origem.quantidade_referencia, 0),
      coalesce(excluded.quantidade_referencia, 0)
    ),
    quantidade_aprovada = round(
      coalesce(public.parque_pedidos_aprovacao_origem.quantidade_aprovada, 0)
      + coalesce(excluded.quantidade_aprovada, 0),
      2
    ),
    aprovado = public.parque_pedidos_aprovacao_origem.aprovado
      or round(
        coalesce(public.parque_pedidos_aprovacao_origem.quantidade_aprovada, 0)
        + coalesce(excluded.quantidade_aprovada, 0),
        2
      ) >= greatest(
        greatest(
          coalesce(public.parque_pedidos_aprovacao_origem.quantidade_referencia, 0),
          coalesce(excluded.quantidade_referencia, 0)
        ) - v_tolerancia,
        0
      ),
    ultima_aprovacao_em = now(),
    updated_at = now();

  update public.parque_pedidos_aprovacao_origem
  set
    quantidade_aprovada = least(quantidade_aprovada, quantidade_referencia),
    aprovado = true,
    updated_at = now()
  where origem_chave = v_origem_chave
    and quantidade_aprovada >= quantidade_referencia - v_tolerancia;
end;
$$;

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

  perform public.parque_registrar_aprovacao_pedido_origem(p_pedido_compra_id, p_quantidade);
end;
$$;

insert into public.parque_pedidos_aprovacao_origem (
  origem_chave,
  ano,
  mes,
  item,
  loja,
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
  coalesce(
    nullif(pi_direto.loja, ''),
    nullif(pi_match.loja, ''),
    nullif(m.setor, ''),
    null
  ) as loja,
  round(coalesce(m.quantidade, 0)::numeric, 2) as quantidade_referencia,
  round(greatest(
    coalesce(pa.quantidade_aprovada, 0),
    coalesce(sum(pm.quantidade), 0)
  )::numeric, 2) as quantidade_aprovada,
  (
    coalesce(pa.aprovado, false)
    or greatest(coalesce(pa.quantidade_aprovada, 0), coalesce(sum(pm.quantidade), 0))
       >= greatest(coalesce(m.quantidade, 0)::numeric - 0.01, 0)
  ) as aprovado,
  coalesce(
    min(coalesce(pm.data_movimentacao, pm.created_at)),
    min(pa.primeira_aprovacao_em),
    now()
  ) as primeira_aprovacao_em,
  coalesce(
    max(coalesce(pm.data_movimentacao, pm.created_at)),
    max(pa.ultima_aprovacao_em),
    now()
  ) as ultima_aprovacao_em
from public.pc_mensal_itens m
left join public.parque_pedidos_aprovacao pa
  on pa.pedido_compra_id = m.id
left join public.parque_movimentacoes pm
  on pm.pedido_compra_id = m.id
 and pm.tipo_movimentacao = 'entrada_compra'
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
group by
  m.id,
  m.origem_chave,
  m.protocolo_item_id,
  m.protocolo_id,
  m.ano,
  m.mes,
  m.item,
  m.quantidade,
  m.valor_unit,
  m.valor_total_frete,
  m.setor,
  pa.quantidade_aprovada,
  pa.aprovado,
  pi_direto.loja,
  pi_match.loja
on conflict (origem_chave) do update
set
  ano = coalesce(excluded.ano, public.parque_pedidos_aprovacao_origem.ano),
  mes = coalesce(excluded.mes, public.parque_pedidos_aprovacao_origem.mes),
  item = coalesce(excluded.item, public.parque_pedidos_aprovacao_origem.item),
  loja = coalesce(excluded.loja, public.parque_pedidos_aprovacao_origem.loja),
  quantidade_referencia = greatest(
    coalesce(public.parque_pedidos_aprovacao_origem.quantidade_referencia, 0),
    coalesce(excluded.quantidade_referencia, 0)
  ),
  quantidade_aprovada = greatest(
    coalesce(public.parque_pedidos_aprovacao_origem.quantidade_aprovada, 0),
    coalesce(excluded.quantidade_aprovada, 0)
  ),
  aprovado = public.parque_pedidos_aprovacao_origem.aprovado or excluded.aprovado,
  primeira_aprovacao_em = least(public.parque_pedidos_aprovacao_origem.primeira_aprovacao_em, excluded.primeira_aprovacao_em),
  ultima_aprovacao_em = greatest(public.parque_pedidos_aprovacao_origem.ultima_aprovacao_em, excluded.ultima_aprovacao_em),
  updated_at = now();

-- Fallback defensivo: se já existe histórico no Custos das Clínicas no mês/ano do pedido,
-- marca a chave como aprovada para evitar falso "pedido pendente" após reprocessamentos de IDs.
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
    and public.parque_normalizar_texto(cm.product) = public.parque_normalizar_texto(m.item)
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
      coalesce(pao.aprovado, false) as aprovado_origem
    from com_chave c
    left join public.parque_pedidos_aprovacao_origem pao
      on pao.origem_chave = c.origem_chave_resolvida
  ),
  final as (
    select
      e.*,
      greatest(e.quantidade_alocada_id, e.quantidade_alocada_origem)::numeric as quantidade_alocada_final
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

alter table public.parque_pedidos_aprovacao_origem enable row level security;

drop policy if exists parque_pedidos_aprovacao_origem_read on public.parque_pedidos_aprovacao_origem;
create policy parque_pedidos_aprovacao_origem_read
on public.parque_pedidos_aprovacao_origem
for select
to authenticated
using (has_module_access('parque_tecnologico'));

drop policy if exists parque_pedidos_aprovacao_origem_manage on public.parque_pedidos_aprovacao_origem;
create policy parque_pedidos_aprovacao_origem_manage
on public.parque_pedidos_aprovacao_origem
for all
to authenticated
using (has_module_edit_access('parque_tecnologico'))
with check (has_module_edit_access('parque_tecnologico'));

grant select, insert, update, delete on public.parque_pedidos_aprovacao_origem to authenticated;
grant execute on function public.parque_resolver_origem_chave_pedido(text, uuid, uuid, integer, integer, text, numeric, numeric, numeric, text) to authenticated;
grant execute on function public.parque_registrar_aprovacao_pedido_origem(uuid, numeric) to authenticated;
grant execute on function public.parque_registrar_aprovacao_pedido(uuid, numeric) to authenticated;
grant execute on function public.parque_list_pedidos_entregues() to authenticated;
