set search_path = public;

create or replace function public.parque_registrar_movimentacao(
  p_produto_id uuid,
  p_tipo_movimentacao text,
  p_quantidade numeric,
  p_origem_tipo text default null,
  p_origem_id uuid default null,
  p_origem_descricao text default null,
  p_destino_tipo text default null,
  p_destino_id uuid default null,
  p_destino_descricao text default null,
  p_data_movimentacao timestamptz default now(),
  p_observacao text default null,
  p_pedido_compra_id uuid default null,
  p_custo_unitario numeric default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  movement_id uuid;
begin
  if has_module_edit_access('parque_tecnologico') is not true then
    raise exception
      'Sem permissão para registrar movimentações. Usuário atual: %',
      coalesce(auth.uid()::text, 'NULL');
  end if;

  insert into public.parque_movimentacoes (
    produto_id,
    tipo_movimentacao,
    origem_tipo,
    origem_id,
    origem_descricao,
    destino_tipo,
    destino_id,
    destino_descricao,
    quantidade,
    custo_unitario,
    data_movimentacao,
    observacao,
    pedido_compra_id,
    created_by
  ) values (
    p_produto_id,
    p_tipo_movimentacao,
    p_origem_tipo,
    p_origem_id,
    nullif(p_origem_descricao, ''),
    p_destino_tipo,
    p_destino_id,
    nullif(p_destino_descricao, ''),
    p_quantidade,
    p_custo_unitario,
    coalesce(p_data_movimentacao, now()),
    nullif(p_observacao, ''),
    p_pedido_compra_id,
    auth.uid()
  ) returning id into movement_id;

  return movement_id;
exception
  when others then
    raise exception
      'Falha ao registrar movimentação: % (SQLSTATE %). Dados: tipo=%; origem_tipo=%; destino_tipo=%; destino=%; qtd=%; pedido=%; produto=%',
      SQLERRM,
      SQLSTATE,
      coalesce(p_tipo_movimentacao, ''),
      coalesce(p_origem_tipo, ''),
      coalesce(p_destino_tipo, ''),
      coalesce(p_destino_descricao, ''),
      coalesce(p_quantidade::text, ''),
      coalesce(p_pedido_compra_id::text, ''),
      coalesce(p_produto_id::text, '');
end;
$$;
