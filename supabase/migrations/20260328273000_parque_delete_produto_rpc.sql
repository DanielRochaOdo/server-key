set search_path = public;

create or replace function public.parque_delete_produto(
  p_produto_id uuid
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_deleted_id uuid;
begin
  if has_module_edit_access('parque_tecnologico') is not true then
    raise exception 'Sem permissão para excluir produtos do Parque Tecnológico.';
  end if;

  if p_produto_id is null then
    raise exception 'Produto inválido.';
  end if;

  delete from public.parque_descartes
  where produto_id = p_produto_id;

  delete from public.parque_movimentacoes
  where produto_id = p_produto_id;

  delete from public.parque_produtos
  where id = p_produto_id
  returning id into v_deleted_id;

  if v_deleted_id is null then
    raise exception 'Produto não encontrado para exclusão.';
  end if;

  return v_deleted_id;
end;
$$;

grant execute on function public.parque_delete_produto(uuid) to authenticated;
