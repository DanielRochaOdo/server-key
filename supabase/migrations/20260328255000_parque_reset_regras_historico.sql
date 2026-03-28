set search_path = public;

create or replace function public.parque_resolver_setor_matriz(p_texto text)
returns text
language plpgsql
immutable
as $$
declare
  v_texto text;
begin
  v_texto := public.parque_normalizar_texto(p_texto);
  if v_texto like '%CALL CENTER%' then return 'CALL CENTER'; end if;
  if v_texto like '%CREDENCIAMENTO%' then return 'CREDENCIAMENTO'; end if;
  if v_texto like '%FINANCEIRO%' then return 'FINANCEIRO'; end if;
  if v_texto like '%RH%' then return 'RH'; end if;
  if v_texto like '%DP%' then return 'DP'; end if;
  if v_texto like '%ADM%' or v_texto like '%ADMIN%' then return 'ADM'; end if;
  if v_texto like '%TI%' then return 'TI'; end if;
  return 'TI';
end;
$$;

create or replace function public.parque_before_insert_movimentacao()
returns trigger
language plpgsql
as $$
declare
  produto_row public.parque_produtos%rowtype;
  pedido_row public.pc_mensal_itens%rowtype;
  current_cost numeric(14,2);
  clinic_key text;
  quantidade_ja_registrada numeric(14,2);
  quantidade_disponivel numeric(14,2);
  setor_key text;
  setores_validos text[] := array['TI', 'ADM', 'CALL CENTER', 'CREDENCIAMENTO', 'FINANCEIRO', 'DP', 'RH'];
begin
  select * into produto_row
  from public.parque_produtos
  where id = new.produto_id
  for update;

  if not found then
    raise exception 'Produto nao encontrado.';
  end if;

  if new.tipo_movimentacao not in ('entrada_manual', 'entrada_compra', 'saida_clinica', 'saida_setor', 'descarte') then
    raise exception 'Tipo de movimentacao invalido.';
  end if;

  if coalesce(new.quantidade, 0) <= 0 then
    raise exception 'Quantidade deve ser maior que zero.';
  end if;

  if new.created_by is null then
    new.created_by := auth.uid();
  end if;

  if new.tipo_movimentacao = 'entrada_compra' then
    if new.pedido_compra_id is null then
      raise exception 'Selecione um pedido entregue para entrada por compra.';
    end if;

    select * into pedido_row
    from public.pc_mensal_itens
    where id = new.pedido_compra_id
    for update;

    if not found then
      raise exception 'Pedido de compra nao encontrado.';
    end if;

    if pedido_row.status <> 'ENTREGUE' then
      raise exception 'Somente pedidos entregues podem gerar entrada no parque.';
    end if;

    select coalesce(sum(pm.quantidade), 0)::numeric(14,2)
      into quantidade_ja_registrada
    from public.parque_movimentacoes pm
    where pm.pedido_compra_id = new.pedido_compra_id
      and pm.tipo_movimentacao = 'entrada_compra';

    quantidade_disponivel := coalesce(pedido_row.quantidade, 0) - coalesce(quantidade_ja_registrada, 0);

    if quantidade_disponivel <= 0 then
      raise exception 'Pedido entregue ja foi totalmente incluido no estoque.';
    end if;

    if new.quantidade > quantidade_disponivel then
      raise exception 'Quantidade informada excede saldo disponivel do pedido.';
    end if;

    new.origem_tipo := 'compra';
    new.origem_descricao := coalesce(nullif(upper(trim(new.origem_descricao)), ''), upper(coalesce(nullif(trim(pedido_row.item), ''), 'COMPRA')));
    new.destino_tipo := 'estoque';
    new.destino_descricao := 'PARQUE TECNOLOGICO';

    if new.custo_unitario is null and coalesce(pedido_row.quantidade, 0) > 0 then
      new.custo_unitario := round((coalesce(pedido_row.valor_total_frete, 0) / pedido_row.quantidade)::numeric, 2);
    end if;
    return new;
  end if;

  if new.tipo_movimentacao = 'entrada_manual' then
    new.origem_tipo := 'pre-cadastro';
    new.origem_descricao := coalesce(nullif(upper(trim(new.origem_descricao)), ''), 'PRE-CADASTRO');
    new.destino_tipo := 'estoque';
    new.destino_descricao := 'PARQUE TECNOLOGICO';
    return new;
  end if;

  current_cost := coalesce(produto_row.custo_medio_atual, 0);
  if new.custo_unitario is null and current_cost > 0 then
    new.custo_unitario := current_cost;
  end if;

  if produto_row.quantidade_atual < new.quantidade then
    raise exception 'Saldo insuficiente para a movimentacao.';
  end if;

  if new.tipo_movimentacao = 'saida_clinica' then
    new.origem_tipo := 'pre-cadastro';
    new.origem_descricao := 'PARQUE TECNOLOGICO';
    new.destino_tipo := 'clinica';

    clinic_key := public.parque_normalize_clinic_key(new.destino_descricao);
    if clinic_key is null then
      select upper(trim(c.clinic))
      into clinic_key
      from public.custos_clinicas_movements c
      where upper(trim(c.clinic)) = upper(trim(coalesce(new.destino_descricao, '')))
      limit 1;
    end if;

    if clinic_key is null or clinic_key = 'MATRIZ' then
      raise exception 'Saida para clinica aceita apenas clinicas cadastradas (MATRIZ deve usar saida_setor).';
    end if;

    new.destino_descricao := clinic_key;
    return new;
  end if;

  if new.tipo_movimentacao = 'saida_setor' then
    new.origem_tipo := 'pre-cadastro';
    new.origem_descricao := 'PARQUE TECNOLOGICO';
    new.destino_tipo := 'setor';

    setor_key := upper(trim(coalesce(new.destino_descricao, '')));
    setor_key := regexp_replace(setor_key, '^MATRIZ\s*-\s*', '');
    if not (setor_key = any(setores_validos)) then
      raise exception 'Setor invalido para MATRIZ.';
    end if;

    new.destino_descricao := 'MATRIZ - ' || setor_key;
    return new;
  end if;

  new.origem_tipo := 'pre-cadastro';
  new.origem_descricao := 'PARQUE TECNOLOGICO';
  new.destino_tipo := 'descarte';
  new.destino_descricao := 'DESCARTE';
  return new;
end;
$$;

delete from public.parque_parametros_link;
delete from public.parque_destino_setor_link;

delete from public.parque_parametros_base
where categoria in ('tipo_movimentacao', 'origem_tipo', 'destino_tipo', 'destino_descricao', 'setor');

with defaults(categoria, nome) as (
  values
    ('tipo_movimentacao', 'entrada_compra'),
    ('tipo_movimentacao', 'entrada_manual'),
    ('tipo_movimentacao', 'saida_clinica'),
    ('tipo_movimentacao', 'saida_setor'),
    ('tipo_movimentacao', 'descarte'),
    ('origem_tipo', 'compra'),
    ('origem_tipo', 'pre-cadastro'),
    ('destino_tipo', 'estoque'),
    ('destino_tipo', 'clinica'),
    ('destino_tipo', 'setor'),
    ('destino_tipo', 'descarte'),
    ('destino_descricao', 'PARQUE TECNOLOGICO'),
    ('destino_descricao', 'MATRIZ'),
    ('destino_descricao', 'AGUANAMBI'),
    ('destino_descricao', 'BEZERRA'),
    ('destino_descricao', 'PARANGABA'),
    ('destino_descricao', 'SOBRAL'),
    ('setor', 'TI'),
    ('setor', 'ADM'),
    ('setor', 'CALL CENTER'),
    ('setor', 'CREDENCIAMENTO'),
    ('setor', 'FINANCEIRO'),
    ('setor', 'DP'),
    ('setor', 'RH')
)
insert into public.parque_parametros_base (categoria, nome, ativo)
select d.categoria, d.nome, true
from defaults d
where not exists (
  select 1
  from public.parque_parametros_base p
  where p.categoria = d.categoria
    and lower(trim(p.nome)) = lower(trim(d.nome))
);

insert into public.parque_parametros_base (categoria, nome, ativo)
select distinct
  'destino_descricao',
  upper(trim(cm.clinic)),
  true
from public.custos_clinicas_movements cm
where coalesce(nullif(trim(cm.clinic), ''), '') <> ''
  and not exists (
    select 1
    from public.parque_parametros_base p
    where p.categoria = 'destino_descricao'
      and lower(trim(p.nome)) = lower(trim(cm.clinic))
  );

delete from public.parque_descartes;
delete from public.parque_movimentacoes;

update public.parque_produtos
set quantidade_atual = 0,
    custo_medio_atual = 0,
    updated_at = now();

alter table public.parque_movimentacoes disable trigger user;

do $$
declare
  c record;
  v_produto_id uuid;
  v_item_id uuid;
  v_item_nome text;
  v_produto_label text;
  v_data_movimentacao timestamptz;
  v_quantidade numeric(14,2);
  v_custo_unitario numeric(14,2);
  v_clinic text;
  v_setor text;
begin
  for c in
    select
      cm.id,
      cm.product,
      cm.store,
      cm.clinic,
      cm.quantity,
      cm.unit_cost,
      cm.total_cost,
      cm.created_at,
      cm.competencia
    from public.custos_clinicas_movements cm
    where coalesce(cm.quantity, 0) > 0
      and coalesce(nullif(trim(cm.product), ''), '') <> ''
    order by cm.created_at asc, cm.id asc
  loop
    v_produto_label := public.parque_normalizar_texto(c.product);
    v_quantidade := coalesce(c.quantity, 0)::numeric(14,2);
    if v_quantidade <= 0 then
      continue;
    end if;

    v_custo_unitario := coalesce(
      c.unit_cost,
      case when coalesce(c.quantity, 0) > 0 then (coalesce(c.total_cost, 0) / c.quantity) else 0 end
    )::numeric(14,2);

    v_data_movimentacao := coalesce(c.created_at, (c.competencia::timestamptz + interval '12 hour'));

    select p.id
      into v_produto_id
    from public.parque_produtos p
    where public.parque_normalizar_texto(public.parque_produto_label(p.id)) = v_produto_label
    order by p.created_at asc
    limit 1;

    if v_produto_id is null then
      select p.id
        into v_produto_id
      from public.parque_produtos p
      join public.parque_itens_base ib on ib.id = p.item_base_id
      where v_produto_label like '%' || public.parque_normalizar_texto(ib.nome) || '%'
      order by
        case
          when coalesce(nullif(public.parque_normalizar_texto(p.especificacao_valor), ''), '') <> ''
               and v_produto_label like '%' || public.parque_normalizar_texto(p.especificacao_valor) || '%'
            then 0
          else 1
        end,
        p.created_at asc
      limit 1;
    end if;

    if v_produto_id is null then
      v_item_nome := upper(trim(c.product));
      insert into public.parque_itens_base (nome, ativo)
      select v_item_nome, true
      where not exists (
        select 1
        from public.parque_itens_base ib
        where public.parque_normalizar_texto(ib.nome) = public.parque_normalizar_texto(v_item_nome)
      );

      select ib.id
        into v_item_id
      from public.parque_itens_base ib
      where public.parque_normalizar_texto(ib.nome) = public.parque_normalizar_texto(v_item_nome)
      order by ib.created_at asc
      limit 1;

      select p.id
        into v_produto_id
      from public.parque_produtos p
      where p.item_base_id = v_item_id
        and public.parque_normalizar_texto(p.categoria) = 'TECNOLOGIA'
        and coalesce(nullif(public.parque_normalizar_texto(p.especificacao_valor), ''), '') = ''
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
        )
        returning id into v_produto_id;
      end if;
    end if;

    insert into public.parque_movimentacoes (
      produto_id,
      tipo_movimentacao,
      origem_tipo,
      origem_descricao,
      destino_tipo,
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
      'entrada_compra',
      'compra',
      upper(coalesce(nullif(trim(c.store), ''), 'COMPRA')),
      'estoque',
      'PARQUE TECNOLOGICO',
      v_quantidade,
      v_custo_unitario,
      (v_data_movimentacao - interval '1 second'),
      'HISTORICO RECONSTRUIDO A PARTIR DE CUSTOS CLINICAS',
      null,
      null,
      null,
      (v_data_movimentacao - interval '1 second')
    );

    v_clinic := public.parque_normalize_clinic_key(c.clinic);
    if v_clinic is null then
      continue;
    end if;

    if v_clinic = 'MATRIZ' then
      v_setor := public.parque_resolver_setor_matriz(c.store);
      insert into public.parque_movimentacoes (
        produto_id,
        tipo_movimentacao,
        origem_tipo,
        origem_descricao,
        destino_tipo,
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
        'saida_setor',
        'pre-cadastro',
        'PARQUE TECNOLOGICO',
        'setor',
        'MATRIZ - ' || v_setor,
        v_quantidade,
        v_custo_unitario,
        v_data_movimentacao,
        'HISTORICO RECONSTRUIDO A PARTIR DE CUSTOS CLINICAS',
        null,
        null,
        null,
        v_data_movimentacao
      );
    else
      insert into public.parque_movimentacoes (
        produto_id,
        tipo_movimentacao,
        origem_tipo,
        origem_descricao,
        destino_tipo,
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
        'pre-cadastro',
        'PARQUE TECNOLOGICO',
        'clinica',
        v_clinic,
        v_quantidade,
        v_custo_unitario,
        v_data_movimentacao,
        'HISTORICO RECONSTRUIDO A PARTIR DE CUSTOS CLINICAS',
        null,
        c.id,
        null,
        v_data_movimentacao
      );
    end if;
  end loop;
end;
$$;

alter table public.parque_movimentacoes enable trigger user;

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
