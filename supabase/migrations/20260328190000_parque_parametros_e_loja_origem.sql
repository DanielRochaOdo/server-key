set search_path = public;

create table if not exists public.parque_parametros_base (
  id uuid primary key default gen_random_uuid(),
  categoria text not null check (categoria in ('tipo_movimentacao', 'origem_tipo', 'destino_tipo', 'destino_descricao')),
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists parque_parametros_base_categoria_nome_unique
  on public.parque_parametros_base (categoria, lower(trim(nome)));

create index if not exists parque_parametros_base_categoria_idx
  on public.parque_parametros_base (categoria, ativo);

drop trigger if exists trg_parque_parametros_base_updated_at on public.parque_parametros_base;
create trigger trg_parque_parametros_base_updated_at
before update on public.parque_parametros_base
for each row execute function public.parque_set_updated_at();

with defaults(categoria, nome) as (
  values
    ('tipo_movimentacao', 'entrada_manual'),
    ('tipo_movimentacao', 'entrada_compra'),
    ('tipo_movimentacao', 'saida_clinica'),
    ('tipo_movimentacao', 'saida_setor'),
    ('tipo_movimentacao', 'transferencia'),
    ('tipo_movimentacao', 'ajuste_positivo'),
    ('tipo_movimentacao', 'ajuste_negativo'),
    ('tipo_movimentacao', 'descarte'),
    ('origem_tipo', 'estoque'),
    ('origem_tipo', 'compras'),
    ('origem_tipo', 'clinica'),
    ('origem_tipo', 'setor'),
    ('origem_tipo', 'fornecedor'),
    ('origem_tipo', 'ajuste'),
    ('origem_tipo', 'descarte'),
    ('destino_tipo', 'estoque'),
    ('destino_tipo', 'clinica'),
    ('destino_tipo', 'setor'),
    ('destino_tipo', 'descarte'),
    ('destino_descricao', 'PARQUE TECNOLÓGICO'),
    ('destino_descricao', 'MATRIZ'),
    ('destino_descricao', 'AGUANAMBI'),
    ('destino_descricao', 'BEZERRA'),
    ('destino_descricao', 'PARANGABA'),
    ('destino_descricao', 'SOBRAL')
)
insert into public.parque_parametros_base (categoria, nome, ativo)
select d.categoria, d.nome, true
from defaults d
where not exists (
  select 1
  from public.parque_parametros_base p
  where p.categoria = d.categoria
    and lower(trim(p.nome)) = lower(trim(d.nome))
);

alter table public.parque_parametros_base enable row level security;

drop policy if exists parque_parametros_base_read on public.parque_parametros_base;
create policy parque_parametros_base_read
on public.parque_parametros_base
for select
to authenticated
using (has_module_access('parque_tecnologico'));

drop policy if exists parque_parametros_base_manage on public.parque_parametros_base;
create policy parque_parametros_base_manage
on public.parque_parametros_base
for all
to authenticated
using (has_module_edit_access('parque_tecnologico'))
with check (has_module_edit_access('parque_tecnologico'));

drop function if exists public.parque_list_pedidos_entregues();

create function public.parque_list_pedidos_entregues()
returns table (
  id uuid,
  ano integer,
  mes integer,
  item text,
  loja text,
  quantidade numeric,
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
  select
    m.id,
    m.ano,
    m.mes,
    m.item,
    coalesce(nullif(pi.loja, ''), nullif(m.setor, ''), null) as loja,
    m.quantidade,
    m.valor_unit,
    m.valor_total_frete,
    m.setor,
    m.protocolo_id,
    m.protocolo_item_id,
    concat_ws(' • ',
      concat(lpad(m.mes::text, 2, '0'), '/', m.ano::text),
      m.item,
      concat('Qtd ', trim(to_char(m.quantidade, 'FM999999990.00'))),
      nullif(upper(coalesce(pi.loja, '')), '')
    ) as origem_label
  from public.pc_mensal_itens m
  left join public.pc_protocolo_itens pi
    on pi.id = m.protocolo_item_id
  where m.status = 'ENTREGUE'
    and not exists (
      select 1
      from public.parque_movimentacoes pm
      where pm.pedido_compra_id = m.id
        and pm.tipo_movimentacao = 'entrada_compra'
    )
  order by m.ano desc, m.mes desc, m.created_at desc;
$$;

grant execute on function public.parque_list_pedidos_entregues() to authenticated;
