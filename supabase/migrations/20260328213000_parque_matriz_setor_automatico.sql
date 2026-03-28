set search_path = public;

create or replace function public.parque_extract_matriz_setor(raw_value text)
returns text
language plpgsql
immutable
as $$
declare
  value_normalized text;
  match_group text[];
begin
  value_normalized := upper(trim(coalesce(raw_value, '')));

  if value_normalized = '' then
    return null;
  end if;

  match_group := regexp_match(value_normalized, 'SETOR MATRIZ:\s*([A-Z0-9 /._-]+)');
  if match_group is null or array_length(match_group, 1) = 0 then
    return null;
  end if;

  if btrim(coalesce(match_group[1], '')) = '' then
    return null;
  end if;

  return btrim(match_group[1]);
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
  store_label text;
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

    store_label := case
      when clinic_key = 'MATRIZ' then coalesce(public.parque_extract_matriz_setor(new.observacao), 'TI')
      else 'PARQUE TECNOLOGICO'
    end;

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
      store_label,
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

update public.custos_clinicas_movements c
set store = coalesce(public.parque_extract_matriz_setor(pm.observacao), 'TI')
from public.parque_movimentacoes pm
where pm.custo_clinica_id = c.id
  and public.parque_normalize_clinic_key(c.clinic) = 'MATRIZ';

update public.custos_clinicas_movements
set store = 'TI'
where public.parque_normalize_clinic_key(clinic) = 'MATRIZ'
  and (store is null or btrim(store) = '' or upper(btrim(store)) = 'PARQUE TECNOLOGICO');

grant execute on function public.parque_extract_matriz_setor(text) to authenticated;
