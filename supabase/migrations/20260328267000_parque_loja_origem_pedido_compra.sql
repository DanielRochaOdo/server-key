set search_path = public;

with origem_pedido as (
  select
    m.id as pedido_id,
    upper(
      coalesce(
        nullif(trim(pi.loja), ''),
        nullif(trim(m.setor), ''),
        ''
      )
    ) as loja_origem
  from public.pc_mensal_itens m
  left join public.pc_protocolo_itens pi
    on pi.id = m.protocolo_item_id
)
update public.parque_movimentacoes pm
set
  origem_tipo = 'compra',
  origem_descricao = op.loja_origem
from origem_pedido op
where pm.pedido_compra_id = op.pedido_id
  and op.loja_origem <> ''
  and (
    coalesce(pm.origem_tipo, '') <> 'compra'
    or coalesce(upper(trim(pm.origem_descricao)), '') <> op.loja_origem
    or coalesce(upper(trim(pm.origem_descricao)), '') = 'COMPRA'
  );

create or replace function public.parque_forcar_loja_origem_pedido()
returns trigger
language plpgsql
as $$
declare
  v_loja_origem text;
  v_item text;
begin
  if new.pedido_compra_id is null then
    return new;
  end if;

  select
    upper(coalesce(nullif(trim(pi.loja), ''), nullif(trim(m.setor), ''), '')),
    upper(coalesce(nullif(trim(m.item), ''), 'COMPRA'))
  into v_loja_origem, v_item
  from public.pc_mensal_itens m
  left join public.pc_protocolo_itens pi
    on pi.id = m.protocolo_item_id
  where m.id = new.pedido_compra_id
  limit 1;

  new.origem_tipo := 'compra';
  if coalesce(v_loja_origem, '') <> '' then
    new.origem_descricao := v_loja_origem;
  elsif coalesce(upper(trim(new.origem_descricao)), '') in ('', 'COMPRA') then
    new.origem_descricao := v_item;
  end if;

  return new;
end;
$$;

drop trigger if exists zzz_trg_parque_forcar_loja_origem_pedido on public.parque_movimentacoes;
create trigger zzz_trg_parque_forcar_loja_origem_pedido
before insert or update on public.parque_movimentacoes
for each row execute function public.parque_forcar_loja_origem_pedido();

do $$
declare
  v_invalid integer;
begin
  select count(*)
    into v_invalid
  from public.parque_movimentacoes pm
  where pm.pedido_compra_id is not null
    and coalesce(upper(trim(pm.origem_descricao)), '') = 'COMPRA';

  if v_invalid > 0 then
    raise warning 'Ainda existem % movimentacao(oes) de pedido com LOJA DE ORIGEM = COMPRA; revisar pedidos sem loja preenchida.', v_invalid;
  end if;
end;
$$;
