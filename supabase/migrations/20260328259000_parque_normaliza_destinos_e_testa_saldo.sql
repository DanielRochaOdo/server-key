set search_path = public;

-- 1) Normaliza destinos por tipo de movimentação para evitar saldos inflados por dados legados.

update public.parque_movimentacoes pm
set
  destino_tipo = 'estoque',
  destino_descricao = 'PARQUE TECNOLOGICO'
where pm.tipo_movimentacao in ('entrada_compra', 'entrada_manual', 'ajuste_positivo')
  and not public.parque_is_destino_estoque(pm.destino_tipo, pm.destino_descricao);

update public.parque_movimentacoes pm
set
  destino_tipo = 'clinica',
  destino_descricao = coalesce(
    public.parque_normalize_clinic_key(pm.destino_descricao),
    public.parque_normalize_clinic_key(cm.clinic),
    'AGUANAMBI'
  )
from public.custos_clinicas_movements cm
where pm.tipo_movimentacao = 'saida_clinica'
  and pm.custo_clinica_id = cm.id
  and (
    coalesce(pm.destino_tipo, '') <> 'clinica'
    or public.parque_is_destino_estoque(pm.destino_tipo, pm.destino_descricao)
  );

update public.parque_movimentacoes pm
set
  destino_tipo = 'clinica',
  destino_descricao = coalesce(
    public.parque_normalize_clinic_key(pm.destino_descricao),
    'AGUANAMBI'
  )
where pm.tipo_movimentacao = 'saida_clinica'
  and (
    coalesce(pm.destino_tipo, '') <> 'clinica'
    or public.parque_is_destino_estoque(pm.destino_tipo, pm.destino_descricao)
  );

update public.parque_movimentacoes pm
set
  destino_tipo = 'setor',
  destino_descricao = case
    when public.parque_normalizar_texto(pm.destino_descricao) like 'MATRIZ - %' then upper(trim(pm.destino_descricao))
    else 'MATRIZ - ' || public.parque_resolver_setor_matriz(concat_ws(' ', pm.destino_descricao, pm.observacao, pm.origem_descricao))
  end
where pm.tipo_movimentacao = 'saida_setor'
  and (
    coalesce(pm.destino_tipo, '') <> 'setor'
    or public.parque_is_destino_estoque(pm.destino_tipo, pm.destino_descricao)
  );

update public.parque_movimentacoes pm
set
  destino_tipo = 'descarte',
  destino_descricao = 'DESCARTE'
where pm.tipo_movimentacao in ('descarte', 'ajuste_negativo')
  and (
    coalesce(pm.destino_tipo, '') <> 'descarte'
    or public.parque_is_destino_estoque(pm.destino_tipo, pm.destino_descricao)
  );

-- 2) Recalcula saldos após normalização.
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

-- 3) Testes de consistência (falham a migration se houver divergência).
do $$
declare
  v_bad_saida_estoque integer;
  v_bad_entrada_fora_estoque integer;
  v_mismatch_saldo integer;
begin
  select count(*)
    into v_bad_saida_estoque
  from public.parque_movimentacoes pm
  where pm.tipo_movimentacao in ('saida_clinica', 'saida_setor', 'descarte', 'ajuste_negativo')
    and public.parque_is_destino_estoque(pm.destino_tipo, pm.destino_descricao);

  if v_bad_saida_estoque > 0 then
    raise exception 'Falha teste parque: existem % saídas/descarte ainda marcadas como destino de estoque.', v_bad_saida_estoque;
  end if;

  select count(*)
    into v_bad_entrada_fora_estoque
  from public.parque_movimentacoes pm
  where pm.tipo_movimentacao in ('entrada_compra', 'entrada_manual', 'ajuste_positivo')
    and not public.parque_is_destino_estoque(pm.destino_tipo, pm.destino_descricao);

  if v_bad_entrada_fora_estoque > 0 then
    raise exception 'Falha teste parque: existem % entradas fora do destino PARQUE/ESTOQUE.', v_bad_entrada_fora_estoque;
  end if;

  with calc as (
    select
      p.id as produto_id,
      greatest(
        coalesce(
          sum(
            case
              when public.parque_is_destino_estoque(pm.destino_tipo, pm.destino_descricao) then pm.quantidade
              else -pm.quantidade
            end
          ),
          0
        ),
        0
      )::numeric(14,2) as qtd_calc
    from public.parque_produtos p
    left join public.parque_movimentacoes pm on pm.produto_id = p.id
    group by p.id
  )
  select count(*)
    into v_mismatch_saldo
  from calc c
  join public.parque_produtos p on p.id = c.produto_id
  where round(coalesce(p.quantidade_atual, 0)::numeric, 2) <> round(c.qtd_calc, 2);

  if v_mismatch_saldo > 0 then
    raise exception 'Falha teste parque: % produtos com saldo divergente após recálculo.', v_mismatch_saldo;
  end if;
end;
$$;
