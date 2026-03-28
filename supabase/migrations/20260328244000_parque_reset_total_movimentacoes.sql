set search_path = public;

-- Remove movimentos de custos originados por saidas do Parque.
with parque_cost_ids as (
  select distinct pm.custo_clinica_id
  from public.parque_movimentacoes pm
  where pm.custo_clinica_id is not null
)
delete from public.custos_clinicas_movements c
where c.id in (select custo_clinica_id from parque_cost_ids);

-- Limpa todo o historico operacional do Parque.
delete from public.parque_descartes;
delete from public.parque_movimentacoes;

-- Reposiciona estoque dos produtos para estado base sem historico.
update public.parque_produtos
set
  quantidade_atual = 0,
  custo_medio_atual = 0,
  updated_at = now();
