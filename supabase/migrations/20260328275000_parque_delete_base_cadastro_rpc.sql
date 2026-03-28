set search_path = public;

create or replace function public.parque_delete_base_cadastro(
  p_tipo text,
  p_id uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_produto_id uuid;
  v_categoria_parametro text;
begin
  if has_module_edit_access('parque_tecnologico') is not true then
    raise exception 'Sem permissão para excluir cadastro base do Parque Tecnológico.';
  end if;

  if p_id is null then
    raise exception 'Cadastro inválido.';
  end if;

  if p_tipo = 'itens' then
    delete from public.parque_cadastros_link
    where (origem_tipo = 'itens' and origem_id = p_id)
       or (destino_tipo = 'itens' and destino_id = p_id);

    for v_produto_id in
      select p.id
      from public.parque_produtos p
      where p.item_base_id = p_id
    loop
      perform public.parque_delete_produto(v_produto_id);
    end loop;

    delete from public.parque_itens_base
    where id = p_id;

    if not found then
      raise exception 'Tipo de item não encontrado.';
    end if;

    return;
  end if;

  if p_tipo = 'unidades' then
    delete from public.parque_cadastros_link
    where (origem_tipo = 'unidades' and origem_id = p_id)
       or (destino_tipo = 'unidades' and destino_id = p_id);

    update public.parque_produtos
    set unidade_base_id = null
    where unidade_base_id = p_id;

    update public.parque_item_parametros_link
    set unidade_base_id = null
    where unidade_base_id = p_id;

    delete from public.parque_unidades_base
    where id = p_id;

    if not found then
      raise exception 'Unidade base não encontrada.';
    end if;

    return;
  end if;

  if p_tipo = 'marcas' then
    delete from public.parque_cadastros_link
    where (origem_tipo = 'marcas' and origem_id = p_id)
       or (destino_tipo = 'marcas' and destino_id = p_id);

    update public.parque_produtos
    set marca_base_id = null
    where marca_base_id = p_id;

    update public.parque_item_parametros_link
    set marca_base_id = null
    where marca_base_id = p_id;

    delete from public.parque_marcas_base
    where id = p_id;

    if not found then
      raise exception 'Marca base não encontrada.';
    end if;

    return;
  end if;

  if p_tipo in ('categorias_produto', 'especificacoes_produto') then
    select pb.categoria
      into v_categoria_parametro
    from public.parque_parametros_base pb
    where pb.id = p_id;

    if v_categoria_parametro is null then
      raise exception 'Parâmetro base não encontrado.';
    end if;

    if p_tipo = 'categorias_produto' and v_categoria_parametro <> 'categoria_produto' then
      raise exception 'Parâmetro informado não é uma categoria de produto.';
    end if;

    if p_tipo = 'especificacoes_produto' and v_categoria_parametro <> 'especificacao_produto' then
      raise exception 'Parâmetro informado não é uma especificação de produto.';
    end if;

    delete from public.parque_cadastros_link
    where (origem_tipo = p_tipo and origem_id = p_id)
       or (destino_tipo = p_tipo and destino_id = p_id);

    delete from public.parque_parametros_link
    where origem_parametro_id = p_id
       or destino_parametro_id = p_id;

    update public.parque_item_parametros_link
    set categoria_parametro_id = null
    where categoria_parametro_id = p_id;

    update public.parque_item_parametros_link
    set especificacao_parametro_id = null
    where especificacao_parametro_id = p_id;

    delete from public.parque_parametros_base
    where id = p_id
      and categoria in ('categoria_produto', 'especificacao_produto');

    if not found then
      raise exception 'Parâmetro base não encontrado para exclusão.';
    end if;

    return;
  end if;

  raise exception 'Tipo de cadastro não suportado para exclusão.';
end;
$$;

grant execute on function public.parque_delete_base_cadastro(text, uuid) to authenticated;
