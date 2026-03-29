set search_path = public;

with entradas as (
  select
    pm.id,
    pm.produto_id,
    case
      when upper(coalesce(regexp_replace(upper(coalesce(pm.observacao, '')), '^.*AUTOMATICAMENTE:\s*', ''), '')) like '%AGUANAMBI%' then 'AGUANAMBI'
      when upper(coalesce(regexp_replace(upper(coalesce(pm.observacao, '')), '^.*AUTOMATICAMENTE:\s*', ''), '')) like '%BEZERRA%' then 'BEZERRA'
      when upper(coalesce(regexp_replace(upper(coalesce(pm.observacao, '')), '^.*AUTOMATICAMENTE:\s*', ''), '')) like '%PARANGABA%' then 'PARANGABA'
      when upper(coalesce(regexp_replace(upper(coalesce(pm.observacao, '')), '^.*AUTOMATICAMENTE:\s*', ''), '')) like '%SOBRAL%' then 'SOBRAL'
      when upper(coalesce(regexp_replace(upper(coalesce(pm.observacao, '')), '^.*AUTOMATICAMENTE:\s*', ''), '')) like '%MATRIZ%' then 'MATRIZ'
      when upper(coalesce(regexp_replace(upper(coalesce(pm.observacao, '')), '^.*AUTOMATICAMENTE:\s*', ''), '')) like '%ADMIN%' then 'MATRIZ'
      when upper(coalesce(regexp_replace(upper(coalesce(pm.observacao, '')), '^.*AUTOMATICAMENTE:\s*', ''), '')) like '%ADM%' then 'MATRIZ'
      else null
    end as clinic_from_observacao
  from public.parque_movimentacoes pm
  where pm.tipo_movimentacao = 'entrada_compra'
    and upper(coalesce(pm.observacao, '')) like '%AUTOMATICAMENTE:%'
),
source_dates as (
  select
    e.id,
    coalesce(
      (
        select sm.data_movimentacao
        from public.parque_movimentacoes sm
        where sm.tipo_movimentacao = 'saida_clinica'
          and sm.produto_id = e.produto_id
          and (
            e.clinic_from_observacao is null
            or (
              case
                when upper(coalesce(sm.destino_descricao, '')) like '%AGUANAMBI%' then 'AGUANAMBI'
                when upper(coalesce(sm.destino_descricao, '')) like '%BEZERRA%' then 'BEZERRA'
                when upper(coalesce(sm.destino_descricao, '')) like '%PARANGABA%' then 'PARANGABA'
                when upper(coalesce(sm.destino_descricao, '')) like '%SOBRAL%' then 'SOBRAL'
                when upper(coalesce(sm.destino_descricao, '')) like '%MATRIZ%' then 'MATRIZ'
                when upper(coalesce(sm.destino_descricao, '')) like '%ADMIN%' then 'MATRIZ'
                when upper(coalesce(sm.destino_descricao, '')) like '%ADM%' then 'MATRIZ'
                else null
              end
            ) = e.clinic_from_observacao
          )
        order by sm.data_movimentacao desc
        limit 1
      ),
      (
        select cm.created_at
        from public.parque_produtos p
        join public.parque_itens_base i on i.id = p.item_base_id
        join public.custos_clinicas_movements cm
          on upper(coalesce(cm.product, '')) like '%' || upper(coalesce(i.nome, '')) || '%'
        where p.id = e.produto_id
          and (
            e.clinic_from_observacao is null
            or (
              case
                when upper(coalesce(cm.clinic, '')) like '%AGUANAMBI%' then 'AGUANAMBI'
                when upper(coalesce(cm.clinic, '')) like '%BEZERRA%' then 'BEZERRA'
                when upper(coalesce(cm.clinic, '')) like '%PARANGABA%' then 'PARANGABA'
                when upper(coalesce(cm.clinic, '')) like '%SOBRAL%' then 'SOBRAL'
                when upper(coalesce(cm.clinic, '')) like '%MATRIZ%' then 'MATRIZ'
                when upper(coalesce(cm.clinic, '')) like '%ADMIN%' then 'MATRIZ'
                when upper(coalesce(cm.clinic, '')) like '%ADM%' then 'MATRIZ'
                else null
              end
            ) = e.clinic_from_observacao
          )
        order by cm.created_at desc
        limit 1
      )
    ) as assigned_at
  from entradas e
)
update public.parque_movimentacoes pm
set data_movimentacao = sd.assigned_at
from source_dates sd
where pm.id = sd.id
  and sd.assigned_at is not null
  and pm.data_movimentacao is distinct from sd.assigned_at;
