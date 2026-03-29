set search_path = public;

-- Regra definitiva solicitada:
-- ENTRADA = apenas quando destino for PARQUE TECNOLOGICO
-- SAIDA   = qualquer outro destino

create or replace function public.parque_is_destino_estoque(
  p_destino_tipo text,
  p_destino_descricao text
)
returns boolean
language sql
stable
as $$
  select public.parque_normalizar_texto(p_destino_descricao) = 'PARQUE TECNOLOGICO';
$$;

create or replace function public.parque_movimentacao_delta(
  p_tipo_movimentacao text,
  p_destino_tipo text,
  p_destino_descricao text
)
returns integer
language sql
stable
as $$
  select case
    when public.parque_is_destino_estoque(p_destino_tipo, p_destino_descricao) then 1
    else -1
  end;
$$;

grant execute on function public.parque_is_destino_estoque(text, text) to authenticated;
grant execute on function public.parque_movimentacao_delta(text, text, text) to authenticated;

-- 1) Normaliza destino de entradas para PARQUE TECNOLOGICO.
update public.parque_movimentacoes pm
set
  destino_tipo = 'estoque',
  destino_descricao = 'PARQUE TECNOLOGICO'
where pm.tipo_movimentacao in ('entrada_compra', 'entrada_manual', 'ajuste_positivo')
  and public.parque_normalizar_texto(pm.destino_descricao) <> 'PARQUE TECNOLOGICO';

-- 2) Garante que saídas não fiquem com destino PARQUE.
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
  and public.parque_normalizar_texto(pm.destino_descricao) = 'PARQUE TECNOLOGICO';

update public.parque_movimentacoes pm
set
  destino_tipo = 'clinica',
  destino_descricao = coalesce(public.parque_normalize_clinic_key(pm.destino_descricao), 'AGUANAMBI')
where pm.tipo_movimentacao = 'saida_clinica'
  and public.parque_normalizar_texto(pm.destino_descricao) = 'PARQUE TECNOLOGICO';

update public.parque_movimentacoes pm
set
  destino_tipo = 'setor',
  destino_descricao = 'MATRIZ - ' || public.parque_resolver_setor_matriz(concat_ws(' ', pm.observacao, pm.origem_descricao))
where pm.tipo_movimentacao = 'saida_setor'
  and public.parque_normalizar_texto(pm.destino_descricao) = 'PARQUE TECNOLOGICO';

update public.parque_movimentacoes pm
set
  destino_tipo = 'descarte',
  destino_descricao = 'DESCARTE'
where pm.tipo_movimentacao in ('descarte', 'ajuste_negativo')
  and public.parque_normalizar_texto(pm.destino_descricao) = 'PARQUE TECNOLOGICO';

-- 3) Recalcula saldo geral após normalização.
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

-- 4) Testes obrigatórios de consistência.
do $$
declare
  v_bad_saidas integer;
  v_mismatch integer;
begin
  select count(*)
    into v_bad_saidas
  from public.parque_movimentacoes pm
  where pm.tipo_movimentacao in ('saida_clinica', 'saida_setor', 'descarte', 'ajuste_negativo')
    and public.parque_normalizar_texto(pm.destino_descricao) = 'PARQUE TECNOLOGICO';

  if v_bad_saidas > 0 then
    raise exception 'Falha regra estrita: % saídas ainda estão com destino PARQUE TECNOLOGICO.', v_bad_saidas;
  end if;

  with calc as (
    select
      p.id as produto_id,
      greatest(
        coalesce(
          sum(
            case
              when public.parque_normalizar_texto(pm.destino_descricao) = 'PARQUE TECNOLOGICO' then pm.quantidade
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
    into v_mismatch
  from calc c
  join public.parque_produtos p on p.id = c.produto_id
  where round(coalesce(p.quantidade_atual, 0)::numeric, 2) <> round(c.qtd_calc, 2);

  if v_mismatch > 0 then
    raise exception 'Falha regra estrita: % produtos com saldo divergente.', v_mismatch;
  end if;
end;
$$;
