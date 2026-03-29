set search_path = public;

create or replace function public.parque_after_write_movimentacao()
returns trigger
language plpgsql
as $$
declare
  clinic_movement_id uuid;
  clinic_label text;
  store_label text;
  setor_label text;
begin
  if tg_op = 'INSERT' then
    if new.custo_clinica_id is null and new.destino_tipo in ('clinica', 'setor') then
      if new.destino_tipo = 'setor' then
        clinic_label := 'MATRIZ';
        setor_label := upper(trim(regexp_replace(coalesce(new.destino_descricao, ''), '^MATRIZ\\s*-\\s*', '', 'i')));
        if coalesce(setor_label, '') = '' then
          setor_label := public.parque_resolver_setor_matriz(concat_ws(' ', new.destino_descricao, new.observacao, new.origem_descricao));
        end if;
        store_label := coalesce(nullif(setor_label, ''), 'TI');
      else
        clinic_label := coalesce(
          public.parque_normalize_clinic_key(new.destino_descricao),
          upper(trim(coalesce(new.destino_descricao, ''))),
          'CLINICA'
        );
        store_label := coalesce(nullif(upper(trim(coalesce(new.origem_descricao, ''))), ''), 'PARQUE TECNOLOGICO');
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
        date_trunc('month', coalesce(new.data_movimentacao, now()))::date,
        clinic_label,
        coalesce(public.parque_produto_label(new.produto_id), 'PRODUTO'),
        store_label,
        greatest(round(coalesce(new.quantidade, 0))::integer, 1),
        coalesce(new.custo_unitario, 0),
        round((coalesce(new.quantidade, 0) * coalesce(new.custo_unitario, 0))::numeric, 2),
        new.created_by,
        coalesce(new.created_at, now())
      ) returning id into clinic_movement_id;

      update public.parque_movimentacoes
      set custo_clinica_id = clinic_movement_id
      where id = new.id;
    end if;

    perform public.parque_recalcular_produto_saldo(new.produto_id);
    return null;
  end if;

  if tg_op = 'UPDATE' then
    if old.produto_id is distinct from new.produto_id then
      perform public.parque_recalcular_produto_saldo(old.produto_id);
    end if;
    perform public.parque_recalcular_produto_saldo(new.produto_id);
    return null;
  end if;

  if tg_op = 'DELETE' then
    perform public.parque_recalcular_produto_saldo(old.produto_id);
    return null;
  end if;

  return null;
end;
$$;

update public.custos_clinicas_movements c
set
  clinic = 'MATRIZ',
  store = coalesce(
    nullif(upper(trim(regexp_replace(coalesce(pm.destino_descricao, ''), '^MATRIZ\\s*-\\s*', '', 'i'))), ''),
    public.parque_resolver_setor_matriz(concat_ws(' ', pm.destino_descricao, pm.observacao, pm.origem_descricao)),
    'TI'
  ),
  product = coalesce(public.parque_produto_label(pm.produto_id), c.product),
  quantity = greatest(round(coalesce(pm.quantidade, 0))::integer, 1),
  unit_cost = coalesce(pm.custo_unitario, 0),
  total_cost = round((coalesce(pm.quantidade, 0) * coalesce(pm.custo_unitario, 0))::numeric, 2),
  competencia = date_trunc('month', coalesce(pm.data_movimentacao, c.competencia::timestamp))::date
from public.parque_movimentacoes pm
where pm.custo_clinica_id = c.id
  and pm.destino_tipo = 'setor';

do $$
declare
  row_mov record;
  linked_cost_id uuid;
  clinic_label text;
  store_label text;
  setor_label text;
  product_label text;
  row_competencia date;
  row_quantity integer;
  row_unit_cost numeric(12,2);
  row_total_cost numeric(12,2);
  row_created_at timestamptz;
begin
  for row_mov in
    select
      pm.id,
      pm.produto_id,
      pm.destino_tipo,
      pm.destino_descricao,
      pm.origem_descricao,
      pm.observacao,
      pm.quantidade,
      pm.custo_unitario,
      pm.data_movimentacao,
      pm.created_by,
      pm.created_at
    from public.parque_movimentacoes pm
    where pm.custo_clinica_id is null
      and pm.destino_tipo in ('clinica', 'setor')
  loop
    if row_mov.destino_tipo = 'setor' then
      clinic_label := 'MATRIZ';
      setor_label := upper(trim(regexp_replace(coalesce(row_mov.destino_descricao, ''), '^MATRIZ\\s*-\\s*', '', 'i')));
      if coalesce(setor_label, '') = '' then
        setor_label := public.parque_resolver_setor_matriz(concat_ws(' ', row_mov.destino_descricao, row_mov.observacao, row_mov.origem_descricao));
      end if;
      store_label := coalesce(nullif(setor_label, ''), 'TI');
    else
      clinic_label := coalesce(
        public.parque_normalize_clinic_key(row_mov.destino_descricao),
        upper(trim(coalesce(row_mov.destino_descricao, ''))),
        'CLINICA'
      );
      store_label := coalesce(nullif(upper(trim(coalesce(row_mov.origem_descricao, ''))), ''), 'PARQUE TECNOLOGICO');
    end if;

    product_label := coalesce(public.parque_produto_label(row_mov.produto_id), 'PRODUTO');
    row_competencia := date_trunc('month', coalesce(row_mov.data_movimentacao, row_mov.created_at, now()))::date;
    row_quantity := greatest(round(coalesce(row_mov.quantidade, 0))::integer, 1);
    row_unit_cost := coalesce(row_mov.custo_unitario, 0);
    row_total_cost := round((coalesce(row_mov.quantidade, 0) * coalesce(row_mov.custo_unitario, 0))::numeric, 2);
    row_created_at := coalesce(row_mov.created_at, now());

    select c.id
      into linked_cost_id
    from public.custos_clinicas_movements c
    where c.competencia = row_competencia
      and upper(trim(c.clinic)) = clinic_label
      and upper(trim(c.product)) = product_label
      and upper(trim(c.store)) = store_label
      and c.quantity = row_quantity
      and c.unit_cost = row_unit_cost
      and c.total_cost = row_total_cost
      and abs(extract(epoch from (coalesce(c.created_at, now()) - row_created_at))) <= 5
      and not exists (
        select 1
        from public.parque_movimentacoes pm2
        where pm2.custo_clinica_id = c.id
      )
    order by c.created_at desc
    limit 1;

    if linked_cost_id is null then
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
        row_competencia,
        clinic_label,
        product_label,
        store_label,
        row_quantity,
        row_unit_cost,
        row_total_cost,
        row_mov.created_by,
        row_created_at
      )
      returning id into linked_cost_id;
    end if;

    update public.parque_movimentacoes
    set custo_clinica_id = linked_cost_id
    where id = row_mov.id;
  end loop;
end;
$$;
