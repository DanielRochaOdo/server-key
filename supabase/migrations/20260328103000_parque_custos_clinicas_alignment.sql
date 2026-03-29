-- Parque Tecnologico -> Custos das Clinicas alignment
-- Garante que os registros originados do Parque Tecnologico sigam o mesmo
-- padrao de preenchimento esperado no modulo Custos das Clinicas.

create or replace function public.parque_normalize_clinic_key(raw_value text)
returns text
language plpgsql
immutable
as $$
declare
  value_normalized text;
begin
  value_normalized := upper(trim(coalesce(raw_value, '')));

  if value_normalized = '' then
    return null;
  end if;

  if value_normalized in ('MATRIZ', 'AGUANAMBI', 'BEZERRA', 'PARANGABA', 'SOBRAL') then
    return value_normalized;
  end if;

  if value_normalized like '%AGUANAMBI%' then
    return 'AGUANAMBI';
  end if;
  if value_normalized like '%BEZERRA%' then
    return 'BEZERRA';
  end if;
  if value_normalized like '%PARANGABA%' then
    return 'PARANGABA';
  end if;
  if value_normalized like '%SOBRAL%' then
    return 'SOBRAL';
  end if;
  if value_normalized like '%MATRIZ%' or value_normalized like '%ADMIN%' or value_normalized like '%ADM%' then
    return 'MATRIZ';
  end if;

  return null;
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
begin
  select * into produto_row
  from public.parque_produtos
  where id = new.produto_id
  for update;

  if not found then
    raise exception 'Produto nao encontrado.';
  end if;

  if new.tipo_movimentacao not in (
    'entrada_manual', 'entrada_compra', 'saida_clinica', 'saida_setor',
    'transferencia', 'ajuste_positivo', 'ajuste_negativo', 'descarte'
  ) then
    raise exception 'Tipo de movimentacao invalido.';
  end if;

  if coalesce(new.quantidade, 0) <= 0 then
    raise exception 'Quantidade deve ser maior que zero.';
  end if;

  if new.created_by is null then
    new.created_by := auth.uid();
  end if;

  if new.tipo_movimentacao in ('ajuste_positivo', 'ajuste_negativo') then
    if public.parque_can_adjust() is not true then
      raise exception 'Apenas perfis autorizados podem realizar ajustes.';
    end if;
    if new.observacao is null or btrim(new.observacao) = '' then
      raise exception 'Observacao e obrigatoria para ajustes.';
    end if;
  end if;

  if new.tipo_movimentacao = 'entrada_manual' then
    new.origem_tipo := 'estoque';
    new.destino_tipo := coalesce(new.destino_tipo, 'estoque');
  end if;

  if new.tipo_movimentacao = 'entrada_compra' then
    if new.pedido_compra_id is null then
      raise exception 'Selecione um pedido entregue para entrada por compra.';
    end if;

    select * into pedido_row
    from public.pc_mensal_itens
    where id = new.pedido_compra_id;

    if not found then
      raise exception 'Pedido de compra nao encontrado.';
    end if;

    if pedido_row.status <> 'ENTREGUE' then
      raise exception 'Somente pedidos entregues podem gerar entrada no parque.';
    end if;

    new.origem_tipo := 'compras';
    new.destino_tipo := 'estoque';
    new.origem_descricao := coalesce(new.origem_descricao, pedido_row.item);

    if new.custo_unitario is null and coalesce(pedido_row.quantidade, 0) > 0 then
      new.custo_unitario := round((coalesce(pedido_row.valor_total_frete, 0) / pedido_row.quantidade)::numeric, 2);
    end if;
  end if;

  if new.tipo_movimentacao = 'saida_clinica' then
    if coalesce(new.destino_tipo, '') <> 'clinica' then
      raise exception 'Saida para clinica exige destino do tipo clinica.';
    end if;

    clinic_key := public.parque_normalize_clinic_key(new.destino_descricao);
    if clinic_key is null then
      raise exception 'Clinica invalida. Use: MATRIZ, AGUANAMBI, BEZERRA, PARANGABA ou SOBRAL.';
    end if;

    new.destino_descricao := clinic_key;
    new.origem_tipo := 'estoque';
  end if;

  if new.tipo_movimentacao = 'saida_setor' then
    if coalesce(new.destino_tipo, '') <> 'setor' then
      raise exception 'Saida para setor exige destino do tipo setor.';
    end if;
    new.origem_tipo := 'estoque';
  end if;

  if new.tipo_movimentacao = 'transferencia' then
    if new.origem_tipo is null or new.destino_tipo is null then
      raise exception 'Transferencia exige origem e destino.';
    end if;
  end if;

  if new.tipo_movimentacao <> 'entrada_compra' then
    new.origem_tipo := 'estoque';
  end if;

  if new.tipo_movimentacao in ('saida_clinica', 'saida_setor', 'transferencia', 'ajuste_negativo', 'descarte') then
    if produto_row.quantidade_atual < new.quantidade then
      raise exception 'Saldo insuficiente para a movimentacao.';
    end if;
    current_cost := coalesce(produto_row.custo_medio_atual, 0);
    if new.custo_unitario is null and current_cost > 0 then
      new.custo_unitario := current_cost;
    end if;
  end if;

  return new;
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
  clinic_key text;
begin
  select * into produto_row
  from public.parque_produtos
  where id = new.produto_id
  for update;

  if public.parque_tipo_delta(new.tipo_movimentacao) = 1 then
    next_quantity := coalesce(produto_row.quantidade_atual, 0) + new.quantidade;
    if coalesce(new.custo_unitario, 0) > 0 then
      total_cost_acc := (coalesce(produto_row.quantidade_atual, 0) * coalesce(produto_row.custo_medio_atual, 0)) + (new.quantidade * new.custo_unitario);
      next_cost := case when next_quantity > 0 then round((total_cost_acc / next_quantity)::numeric, 2) else 0 end;
    else
      next_cost := coalesce(produto_row.custo_medio_atual, 0);
    end if;
  else
    next_quantity := coalesce(produto_row.quantidade_atual, 0) - new.quantidade;
    if next_quantity < 0 then
      raise exception 'Saldo negativo nao permitido.';
    end if;
    next_cost := coalesce(produto_row.custo_medio_atual, 0);
  end if;

  update public.parque_produtos
  set quantidade_atual = next_quantity,
      custo_medio_atual = next_cost,
      updated_at = now()
  where id = new.produto_id;

  if new.tipo_movimentacao = 'saida_clinica' then
    clinic_key := public.parque_normalize_clinic_key(new.destino_descricao);
    if clinic_key is null then
      raise exception 'Clinica invalida para integracao com Custos das Clinicas.';
    end if;

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
      clinic_key,
      coalesce(public.parque_produto_label(new.produto_id), 'PRODUTO'),
      'PARQUE TECNOLOGICO',
      new.quantidade,
      coalesce(new.custo_unitario, 0),
      round((new.quantidade * coalesce(new.custo_unitario, 0))::numeric, 2),
      new.created_by,
      now()
    ) returning id into clinic_movement_id;

    update public.parque_movimentacoes
    set custo_clinica_id = clinic_movement_id,
        destino_descricao = clinic_key
    where id = new.id;
  end if;

  return null;
end;
$$;

-- Ajuste retroativo para manter compatibilidade de leitura do modulo Custos das Clinicas.
update public.parque_movimentacoes
set destino_descricao = public.parque_normalize_clinic_key(destino_descricao)
where tipo_movimentacao = 'saida_clinica'
  and destino_tipo = 'clinica'
  and public.parque_normalize_clinic_key(destino_descricao) is not null
  and destino_descricao is distinct from public.parque_normalize_clinic_key(destino_descricao);

update public.custos_clinicas_movements
set clinic = public.parque_normalize_clinic_key(clinic)
where public.parque_normalize_clinic_key(clinic) is not null
  and clinic is distinct from public.parque_normalize_clinic_key(clinic);

grant execute on function public.parque_normalize_clinic_key(text) to authenticated;
