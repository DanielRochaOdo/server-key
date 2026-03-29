set search_path = public;

-- Regra de saldo:
-- 1) Destino estoque (PARQUE/ESTOQUE) soma no saldo.
-- 2) Movimentos de entrada com destino fora do estoque nao devem subtrair saldo.
--    Ex.: entrada_compra com destino clinica/setor representa compra direta e
--    nao consumo do estoque do parque.
-- 3) Demais movimentos fora do estoque subtraem saldo.
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
    when public.parque_normalizar_texto(p_tipo_movimentacao) in (
      'ENTRADA_COMPRA',
      'ENTRADA COMPRA',
      'ENTRADA_MANUAL',
      'ENTRADA MANUAL',
      'AJUSTE_POSITIVO',
      'AJUSTE POSITIVO'
    ) then 0
    else -1
  end;
$$;

grant execute on function public.parque_movimentacao_delta(text, text, text) to authenticated;

-- Recalcula saldos apos ajuste da regra.
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
