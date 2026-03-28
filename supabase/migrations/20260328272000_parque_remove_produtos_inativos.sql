set search_path = public;

do $$
declare
  v_descartes integer := 0;
  v_movimentacoes integer := 0;
  v_produtos integer := 0;
begin
  with produtos_inativos as (
    select id
    from public.parque_produtos
    where ativo = false
  )
  delete from public.parque_descartes d
  using produtos_inativos p
  where d.produto_id = p.id;

  get diagnostics v_descartes = row_count;

  with produtos_inativos as (
    select id
    from public.parque_produtos
    where ativo = false
  )
  delete from public.parque_movimentacoes m
  using produtos_inativos p
  where m.produto_id = p.id;

  get diagnostics v_movimentacoes = row_count;

  delete from public.parque_produtos
  where ativo = false;

  get diagnostics v_produtos = row_count;

  raise notice 'Parque Tecnológico: removidos % descarte(s), % movimentação(ões) e % produto(s) inativo(s).',
    v_descartes, v_movimentacoes, v_produtos;
end;
$$;
