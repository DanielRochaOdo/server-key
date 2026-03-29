set search_path = public;

-- Limpa os registros de estoque do Parque Tecnológico (produtos),
-- sem alterar os pedidos entregues em pc_mensal_itens.
delete from public.parque_produtos;
