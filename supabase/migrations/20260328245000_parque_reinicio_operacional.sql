set search_path = public;

-- Reinício operacional completo do módulo Parque Tecnológico.
delete from public.parque_descartes;
delete from public.parque_movimentacoes;

update public.parque_produtos
set
  quantidade_atual = 0,
  custo_medio_atual = 0,
  updated_at = now();
