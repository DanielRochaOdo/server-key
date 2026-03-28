set search_path = public;

-- Reset completo dos registros operacionais do Parque Tecnológico:
-- - limpa inventário (movimentações + descartes)
-- - zera saldos de produtos
-- - com isso, pedidos entregues voltam a ficar disponíveis para inclusão

delete from public.parque_descartes;
delete from public.parque_movimentacoes;

update public.parque_produtos
set
  quantidade_atual = 0,
  custo_medio_atual = 0,
  updated_at = now();

-- Verificações de segurança
do $$
declare
  v_movimentacoes integer;
  v_descartes integer;
  v_produtos_com_saldo integer;
begin
  select count(*) into v_movimentacoes from public.parque_movimentacoes;
  select count(*) into v_descartes from public.parque_descartes;
  select count(*) into v_produtos_com_saldo
  from public.parque_produtos
  where coalesce(quantidade_atual, 0) <> 0;

  if v_movimentacoes <> 0 then
    raise exception 'Reset falhou: ainda existem % movimentações.', v_movimentacoes;
  end if;

  if v_descartes <> 0 then
    raise exception 'Reset falhou: ainda existem % descartes.', v_descartes;
  end if;

  if v_produtos_com_saldo <> 0 then
    raise exception 'Reset falhou: ainda existem % produtos com saldo não zerado.', v_produtos_com_saldo;
  end if;
end;
$$;
