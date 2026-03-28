set search_path = public;

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

grant execute on function public.parque_movimentacao_delta(text, text, text) to authenticated;

update public.parque_movimentacoes
set destino_tipo = 'estoque'
where public.parque_is_destino_estoque(destino_tipo, destino_descricao)
  and coalesce(lower(trim(destino_tipo)), '') <> 'estoque';

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
