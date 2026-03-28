set search_path = public;

drop index if exists public.parque_movimentacoes_entrada_compra_unique;

create index if not exists parque_movimentacoes_entrada_compra_pedido_idx
  on public.parque_movimentacoes (pedido_compra_id, data_movimentacao desc)
  where pedido_compra_id is not null and tipo_movimentacao = 'entrada_compra';

create or replace function public.parque_before_insert_movimentacao()
returns trigger
language plpgsql
as $$
declare
  produto_row public.parque_produtos%rowtype;
  pedido_row public.pc_mensal_itens%rowtype;
  current_cost numeric(14,2);
  clinic_key text;
  quantidade_ja_registrada numeric(14,2);
  quantidade_disponivel numeric(14,2);
begin
  select * into produto_row
  from public.parque_produtos
  where id = new.produto_id
  for update;

  if not found then
    raise exception 'Produto nao encontrado.';
  end if;

  if new.tipo_movimentacao not in (
    'entrada_manual', 'entrada_compra', 'saida_clinica', 'saida_setor',
    'transferencia', 'ajuste_positivo', 'ajuste_negativo', 'descarte'
  ) then
    raise exception 'Tipo de movimentacao invalido.';
  end if;

  if coalesce(new.quantidade, 0) <= 0 then
    raise exception 'Quantidade deve ser maior que zero.';
  end if;

  if new.created_by is null then
    new.created_by := auth.uid();
  end if;

  if new.tipo_movimentacao in ('ajuste_positivo', 'ajuste_negativo') then
    if public.parque_can_adjust() is not true then
      raise exception 'Apenas perfis autorizados podem realizar ajustes.';
    end if;
    if new.observacao is null or btrim(new.observacao) = '' then
      raise exception 'Observacao e obrigatoria para ajustes.';
    end if;
  end if;

  if new.tipo_movimentacao = 'entrada_manual' then
    new.origem_tipo := 'estoque';
    new.destino_tipo := coalesce(new.destino_tipo, 'estoque');
  end if;

  if new.tipo_movimentacao = 'entrada_compra' then
    if new.pedido_compra_id is null then
      raise exception 'Selecione um pedido entregue para entrada por compra.';
    end if;

    select * into pedido_row
    from public.pc_mensal_itens
    where id = new.pedido_compra_id
    for update;

    if not found then
      raise exception 'Pedido de compra nao encontrado.';
    end if;

    if pedido_row.status <> 'ENTREGUE' then
      raise exception 'Somente pedidos entregues podem gerar entrada no parque.';
    end if;

    select coalesce(sum(pm.quantidade), 0)::numeric(14,2)
      into quantidade_ja_registrada
    from public.parque_movimentacoes pm
    where pm.pedido_compra_id = new.pedido_compra_id
      and pm.tipo_movimentacao = 'entrada_compra';

    quantidade_disponivel := coalesce(pedido_row.quantidade, 0) - coalesce(quantidade_ja_registrada, 0);

    if quantidade_disponivel <= 0 then
      raise exception 'Pedido entregue ja foi totalmente incluido no inventario.';
    end if;

    if new.quantidade > quantidade_disponivel then
      raise exception 'Quantidade informada (%s) excede saldo disponivel do pedido (%s).',
        trim(to_char(new.quantidade, 'FM999999990.00')),
        trim(to_char(quantidade_disponivel, 'FM999999990.00'));
    end if;

    new.origem_tipo := 'compras';
    new.destino_tipo := 'estoque';
    new.origem_descricao := coalesce(new.origem_descricao, pedido_row.item);

    if new.custo_unitario is null and coalesce(pedido_row.quantidade, 0) > 0 then
      new.custo_unitario := round((coalesce(pedido_row.valor_total_frete, 0) / pedido_row.quantidade)::numeric, 2);
    end if;
  end if;

  if new.tipo_movimentacao = 'saida_clinica' then
    if coalesce(new.destino_tipo, '') <> 'clinica' then
      raise exception 'Saida para clinica exige destino do tipo clinica.';
    end if;

    clinic_key := public.parque_normalize_clinic_key(new.destino_descricao);
    if clinic_key is null then
      raise exception 'Clinica invalida. Use: MATRIZ, AGUANAMBI, BEZERRA, PARANGABA ou SOBRAL.';
    end if;

    new.destino_descricao := clinic_key;
    new.origem_tipo := 'estoque';
  end if;

  if new.tipo_movimentacao = 'saida_setor' then
    if coalesce(new.destino_tipo, '') <> 'setor' then
      raise exception 'Saida para setor exige destino do tipo setor.';
    end if;
    new.origem_tipo := 'estoque';
  end if;

  if new.tipo_movimentacao = 'transferencia' then
    if new.origem_tipo is null or new.destino_tipo is null then
      raise exception 'Transferencia exige origem e destino.';
    end if;
  end if;

  if new.tipo_movimentacao <> 'entrada_compra' then
    new.origem_tipo := 'estoque';
  end if;

  if new.tipo_movimentacao in ('saida_clinica', 'saida_setor', 'transferencia', 'ajuste_negativo', 'descarte') then
    if produto_row.quantidade_atual < new.quantidade then
      raise exception 'Saldo insuficiente para a movimentacao.';
    end if;
    current_cost := coalesce(produto_row.custo_medio_atual, 0);
    if new.custo_unitario is null and current_cost > 0 then
      new.custo_unitario := current_cost;
    end if;
  end if;

  return new;
end;
$$;

drop function if exists public.parque_list_pedidos_entregues();

create function public.parque_list_pedidos_entregues()
returns table (
  id uuid,
  ano integer,
  mes integer,
  item text,
  loja text,
  quantidade numeric,
  quantidade_alocada numeric,
  quantidade_disponivel numeric,
  valor_unit numeric,
  valor_total_frete numeric,
  setor text,
  protocolo_id uuid,
  protocolo_item_id uuid,
  origem_label text
)
language sql
security definer
stable
as $$
  with base as (
    select
      m.id,
      m.ano,
      m.mes,
      m.item,
      coalesce(nullif(pi.loja, ''), nullif(m.setor, ''), null) as loja,
      coalesce(m.quantidade, 0)::numeric as quantidade,
      coalesce((
        select sum(pm.quantidade)
        from public.parque_movimentacoes pm
        where pm.pedido_compra_id = m.id
          and pm.tipo_movimentacao = 'entrada_compra'
      ), 0)::numeric as quantidade_alocada,
      m.valor_unit,
      m.valor_total_frete,
      m.setor,
      m.protocolo_id,
      m.protocolo_item_id
    from public.pc_mensal_itens m
    left join public.pc_protocolo_itens pi
      on pi.id = m.protocolo_item_id
    where m.status = 'ENTREGUE'
  )
  select
    b.id,
    b.ano,
    b.mes,
    b.item,
    b.loja,
    b.quantidade,
    b.quantidade_alocada,
    greatest((b.quantidade - b.quantidade_alocada), 0)::numeric as quantidade_disponivel,
    b.valor_unit,
    b.valor_total_frete,
    b.setor,
    b.protocolo_id,
    b.protocolo_item_id,
    concat_ws(' • ',
      concat(lpad(b.mes::text, 2, '0'), '/', b.ano::text),
      b.item,
      concat('Qtd ', trim(to_char(b.quantidade, 'FM999999990.00'))),
      concat('Saldo ', trim(to_char(greatest((b.quantidade - b.quantidade_alocada), 0), 'FM999999990.00'))),
      nullif(upper(coalesce(b.loja, '')), '')
    ) as origem_label
  from base b
  where greatest((b.quantidade - b.quantidade_alocada), 0) > 0
  order by b.ano desc, b.mes desc, b.id desc;
$$;

grant execute on function public.parque_list_pedidos_entregues() to authenticated;
