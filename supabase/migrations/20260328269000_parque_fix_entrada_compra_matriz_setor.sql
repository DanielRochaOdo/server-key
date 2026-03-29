set search_path = public;

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
  destino_normalizado text;
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

    destino_normalizado := public.parque_normalizar_texto(new.destino_descricao);

    if coalesce(destino_normalizado, '') = '' or destino_normalizado in ('PARQUE TECNOLOGICO', 'ESTOQUE') then
      new.destino_tipo := 'estoque';
      new.destino_descricao := 'PARQUE TECNOLOGICO';
    elsif destino_normalizado = 'DESCARTE' then
      new.destino_tipo := 'descarte';
      new.destino_descricao := 'DESCARTE';
    elsif destino_normalizado like 'MATRIZ %' then
      setor_key := upper(trim(regexp_replace(coalesce(new.destino_descricao, ''), '^MATRIZ\\s*(-\\s*)?', '', 'i')));
      if not (setor_key = any(setores_validos)) then
        raise exception 'Destino de MATRIZ deve ser informado no formato MATRIZ - SETOR valido.';
      end if;
      new.destino_tipo := 'setor';
      new.destino_descricao := 'MATRIZ - ' || setor_key;
    else
      clinic_key := public.parque_normalize_clinic_key(new.destino_descricao);
      if clinic_key is null or clinic_key = 'MATRIZ' then
        raise exception 'Destino invalido para entrada por compra. Use PARQUE TECNOLOGICO, clinica valida ou MATRIZ - SETOR.';
      end if;
      new.destino_tipo := 'clinica';
      new.destino_descricao := clinic_key;
    end if;

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
    setor_key := regexp_replace(setor_key, '^MATRIZ\\s*-\\s*', '');
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
