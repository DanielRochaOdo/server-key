set search_path = public;

update public.parque_movimentacoes pm
set
  origem_tipo = 'compra',
  origem_descricao = coalesce(
    nullif(upper(trim(pm.origem_descricao)), ''),
    upper(coalesce(nullif(trim(pi.loja), ''), nullif(trim(pc.item), ''), 'COMPRA'))
  )
from public.pc_mensal_itens pc
left join public.pc_protocolo_itens pi on pi.id = pc.protocolo_item_id
where pm.pedido_compra_id = pc.id
  and (
    coalesce(pm.origem_tipo, '') <> 'compra'
    or coalesce(nullif(trim(pm.origem_descricao), ''), '') = ''
  );

update public.parque_movimentacoes pm
set
  origem_tipo = 'compra',
  origem_descricao = coalesce(nullif(upper(trim(pm.origem_descricao)), ''), 'COMPRA')
where pm.pedido_compra_id is not null
  and (
    coalesce(pm.origem_tipo, '') <> 'compra'
    or coalesce(nullif(trim(pm.origem_descricao), ''), '') = ''
  );

create or replace function public.parque_enforce_origem_estoque()
returns trigger
language plpgsql
as $$
begin
  if new.pedido_compra_id is not null then
    new.origem_tipo := 'compra';
    new.origem_descricao := coalesce(nullif(upper(trim(new.origem_descricao)), ''), 'COMPRA');
    return new;
  end if;

  if new.tipo_movimentacao in ('saida_clinica', 'saida_setor', 'descarte', 'ajuste_negativo', 'transferencia') then
    new.origem_tipo := 'estoque';
    new.origem_descricao := 'PARQUE TECNOLOGICO';
  elsif new.tipo_movimentacao = 'entrada_compra' then
    new.origem_tipo := 'compra';
    new.origem_descricao := coalesce(nullif(upper(trim(new.origem_descricao)), ''), 'COMPRA');
  elsif new.tipo_movimentacao = 'entrada_manual' then
    new.origem_tipo := 'pre-cadastro';
    new.origem_descricao := coalesce(nullif(new.origem_descricao, ''), 'PRE-CADASTRO');
  end if;
  return new;
end;
$$;

alter table public.parque_movimentacoes
  drop constraint if exists parque_movimentacoes_pedido_origem_compra_check;

alter table public.parque_movimentacoes
  add constraint parque_movimentacoes_pedido_origem_compra_check
  check (pedido_compra_id is null or coalesce(origem_tipo, '') = 'compra') not valid;

alter table public.parque_movimentacoes
  validate constraint parque_movimentacoes_pedido_origem_compra_check;

do $$
declare
  v_invalid integer;
begin
  select count(*)
    into v_invalid
  from public.parque_movimentacoes pm
  where pm.pedido_compra_id is not null
    and coalesce(pm.origem_tipo, '') <> 'compra';

  if v_invalid > 0 then
    raise exception 'Falha: % movimentacao(oes) com pedido_compra_id sem origem COMPRA.', v_invalid;
  end if;
end;
$$;
