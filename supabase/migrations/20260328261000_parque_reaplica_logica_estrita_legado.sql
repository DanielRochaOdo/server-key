set search_path = public;

-- Reaplica a regra estrita no legado:
-- entrada somente quando destino = PARQUE TECNOLOGICO
-- qualquer outro destino = saída

-- 1) Normaliza entradas antigas para PARQUE TECNOLOGICO
update public.parque_movimentacoes pm
set
  destino_tipo = 'estoque',
  destino_descricao = 'PARQUE TECNOLOGICO'
where pm.tipo_movimentacao in ('entrada_compra', 'entrada_manual', 'ajuste_positivo')
  and public.parque_normalizar_texto(pm.destino_descricao) <> 'PARQUE TECNOLOGICO';

-- 2) Corrige saídas antigas indevidamente apontadas para PARQUE TECNOLOGICO
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
  destino_descricao = case
    when public.parque_normalizar_texto(pm.destino_descricao) like 'MATRIZ - %' then upper(trim(pm.destino_descricao))
    else 'MATRIZ - ' || public.parque_resolver_setor_matriz(concat_ws(' ', pm.destino_descricao, pm.observacao, pm.origem_descricao))
  end
where pm.tipo_movimentacao = 'saida_setor'
  and public.parque_normalizar_texto(pm.destino_descricao) = 'PARQUE TECNOLOGICO';

update public.parque_movimentacoes pm
set
  destino_tipo = 'descarte',
  destino_descricao = 'DESCARTE'
where pm.tipo_movimentacao in ('descarte', 'ajuste_negativo')
  and public.parque_normalizar_texto(pm.destino_descricao) = 'PARQUE TECNOLOGICO';

-- 3) Recalcula saldo de todos os produtos com a regra estrita
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
    )::numeric(14,2) as quantidade_recalculada,
    coalesce(
      sum(
        case
          when public.parque_normalizar_texto(pm.destino_descricao) = 'PARQUE TECNOLOGICO'
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
          when public.parque_normalizar_texto(pm.destino_descricao) = 'PARQUE TECNOLOGICO'
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
  quantidade_atual = c.quantidade_recalculada,
  custo_medio_atual = case
    when c.quantidade_com_custo > 0 then round((c.custo_total_entrada / c.quantidade_com_custo)::numeric, 2)
    else 0
  end,
  updated_at = now()
from calc c
where c.produto_id = p.id;

-- 4) Teste final de consistência (abort migration se houver divergência)
do $$
declare
  v_mismatch integer;
begin
  with check_calc as (
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
  from check_calc cc
  join public.parque_produtos p on p.id = cc.produto_id
  where round(coalesce(p.quantidade_atual, 0)::numeric, 2) <> round(cc.qtd_calc, 2);

  if v_mismatch > 0 then
    raise exception 'Reaplicação legado falhou: % produtos com saldo divergente.', v_mismatch;
  end if;
end;
$$;
