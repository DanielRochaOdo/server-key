-- Parque Tecnologico
-- Novo modulo para estoque fisico, rastreabilidade de movimentacoes,
-- descarte e integracao com Pedidos de Compra e Custos das Clinicas.

create extension if not exists pgcrypto;

create table if not exists public.parque_itens_base (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists parque_itens_base_nome_unique
  on public.parque_itens_base (lower(trim(nome)));

create table if not exists public.parque_unidades_base (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  sigla text null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists parque_unidades_base_nome_unique
  on public.parque_unidades_base (lower(trim(nome)));

create table if not exists public.parque_marcas_base (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists parque_marcas_base_nome_unique
  on public.parque_marcas_base (lower(trim(nome)));

create table if not exists public.parque_produtos (
  id uuid primary key default gen_random_uuid(),
  item_base_id uuid not null references public.parque_itens_base(id),
  categoria text not null,
  especificacao_valor text null,
  unidade_base_id uuid null references public.parque_unidades_base(id),
  marca_base_id uuid null references public.parque_marcas_base(id),
  quantidade_atual numeric(14,2) not null default 0,
  quantidade_minima numeric(14,2) null,
  custo_medio_atual numeric(14,2) not null default 0,
  ativo boolean not null default true,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint parque_produtos_quantidade_atual_check check (quantidade_atual >= 0),
  constraint parque_produtos_quantidade_minima_check check (quantidade_minima is null or quantidade_minima >= 0),
  constraint parque_produtos_custo_medio_check check (custo_medio_atual >= 0)
);

create unique index if not exists parque_produtos_unique_key
  on public.parque_produtos (
    item_base_id,
    coalesce(lower(trim(especificacao_valor)), ''),
    coalesce(unidade_base_id::text, ''),
    coalesce(marca_base_id::text, '')
  );

create index if not exists parque_produtos_item_idx on public.parque_produtos (item_base_id);
create index if not exists parque_produtos_marca_idx on public.parque_produtos (marca_base_id);
create index if not exists parque_produtos_unidade_idx on public.parque_produtos (unidade_base_id);
create index if not exists parque_produtos_ativo_idx on public.parque_produtos (ativo);

create table if not exists public.parque_movimentacoes (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.parque_produtos(id),
  tipo_movimentacao text not null,
  origem_tipo text null,
  origem_id uuid null,
  origem_descricao text null,
  destino_tipo text null,
  destino_id uuid null,
  destino_descricao text null,
  quantidade numeric(14,2) not null,
  custo_unitario numeric(14,2) null,
  custo_total numeric(14,2) generated always as (
    case
      when custo_unitario is null then null
      else round((quantidade * custo_unitario)::numeric, 2)
    end
  ) stored,
  data_movimentacao timestamptz not null default now(),
  observacao text null,
  pedido_compra_id uuid null references public.pc_mensal_itens(id) on delete set null,
  custo_clinica_id uuid null references public.custos_clinicas_movements(id) on delete set null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint parque_movimentacoes_quantidade_check check (quantidade > 0)
);

create index if not exists parque_movimentacoes_produto_idx on public.parque_movimentacoes (produto_id);
create index if not exists parque_movimentacoes_tipo_idx on public.parque_movimentacoes (tipo_movimentacao);
create index if not exists parque_movimentacoes_data_idx on public.parque_movimentacoes (data_movimentacao desc);
create index if not exists parque_movimentacoes_pedido_idx on public.parque_movimentacoes (pedido_compra_id);
create unique index if not exists parque_movimentacoes_entrada_compra_unique
  on public.parque_movimentacoes (pedido_compra_id)
  where pedido_compra_id is not null and tipo_movimentacao = 'entrada_compra';

create table if not exists public.parque_descartes (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.parque_produtos(id),
  data_descarte timestamptz not null default now(),
  quantidade numeric(14,2) not null,
  motivo text not null,
  observacao text null,
  movimentacao_id uuid null references public.parque_movimentacoes(id) on delete set null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint parque_descartes_quantidade_check check (quantidade > 0)
);

create unique index if not exists parque_descartes_movimentacao_unique
  on public.parque_descartes (movimentacao_id)
  where movimentacao_id is not null;

create or replace function public.parque_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_parque_itens_base_updated_at on public.parque_itens_base;
create trigger trg_parque_itens_base_updated_at before update on public.parque_itens_base
for each row execute function public.parque_set_updated_at();

drop trigger if exists trg_parque_unidades_base_updated_at on public.parque_unidades_base;
create trigger trg_parque_unidades_base_updated_at before update on public.parque_unidades_base
for each row execute function public.parque_set_updated_at();

drop trigger if exists trg_parque_marcas_base_updated_at on public.parque_marcas_base;
create trigger trg_parque_marcas_base_updated_at before update on public.parque_marcas_base
for each row execute function public.parque_set_updated_at();

drop trigger if exists trg_parque_produtos_updated_at on public.parque_produtos;
create trigger trg_parque_produtos_updated_at before update on public.parque_produtos
for each row execute function public.parque_set_updated_at();
create or replace function public.parque_user_role()
returns text
language plpgsql
security definer
stable
as $$
declare
  user_role text;
begin
  select role into user_role
  from public.users
  where auth_uid = auth.uid();

  return coalesce(user_role, '');
end;
$$;

create or replace function public.parque_can_adjust()
returns boolean
language plpgsql
security definer
stable
as $$
declare
  role_name text;
begin
  role_name := public.parque_user_role();
  return has_module_edit_access('parque_tecnologico') and role_name in ('owner', 'admin');
end;
$$;

create or replace function public.parque_tipo_delta(tipo text)
returns integer
language plpgsql
immutable
as $$
begin
  if tipo in ('entrada_manual', 'entrada_compra', 'ajuste_positivo') then
    return 1;
  end if;
  return -1;
end;
$$;

create or replace function public.parque_produto_label(produto_id uuid)
returns text
language sql
stable
as $$
  select concat_ws(' • ',
    i.nome,
    case
      when p.especificacao_valor is not null and btrim(p.especificacao_valor) <> '' then
        concat(p.especificacao_valor, case when u.sigla is not null and btrim(u.sigla) <> '' then ' ' || u.sigla when u.nome is not null and btrim(u.nome) <> '' then ' ' || u.nome else '' end)
      else null
    end,
    m.nome
  )
  from public.parque_produtos p
  join public.parque_itens_base i on i.id = p.item_base_id
  left join public.parque_unidades_base u on u.id = p.unidade_base_id
  left join public.parque_marcas_base m on m.id = p.marca_base_id
  where p.id = produto_id;
$$;

create or replace function public.parque_before_insert_movimentacao()
returns trigger
language plpgsql
as $$
declare
  produto_row public.parque_produtos%rowtype;
  pedido_row public.pc_mensal_itens%rowtype;
  current_cost numeric(14,2);
begin
  select * into produto_row
  from public.parque_produtos
  where id = new.produto_id
  for update;

  if not found then
    raise exception 'Produto não encontrado.';
  end if;

  if new.tipo_movimentacao not in (
    'entrada_manual', 'entrada_compra', 'saida_clinica', 'saida_setor',
    'transferencia', 'ajuste_positivo', 'ajuste_negativo', 'descarte'
  ) then
    raise exception 'Tipo de movimentação inválido.';
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
      raise exception 'Observação é obrigatória para ajustes.';
    end if;
  end if;

  if new.tipo_movimentacao = 'entrada_compra' then
    if new.pedido_compra_id is null then
      raise exception 'Selecione um pedido entregue para entrada por compra.';
    end if;

    select * into pedido_row
    from public.pc_mensal_itens
    where id = new.pedido_compra_id;

    if not found then
      raise exception 'Pedido de compra não encontrado.';
    end if;

    if pedido_row.status <> 'ENTREGUE' then
      raise exception 'Somente pedidos entregues podem gerar entrada no parque.';
    end if;

    new.origem_tipo := coalesce(new.origem_tipo, 'compras');
    new.destino_tipo := coalesce(new.destino_tipo, 'estoque');
    new.origem_descricao := coalesce(new.origem_descricao, pedido_row.item);

    if new.custo_unitario is null and coalesce(pedido_row.quantidade, 0) > 0 then
      new.custo_unitario := round((coalesce(pedido_row.valor_total_frete, 0) / pedido_row.quantidade)::numeric, 2);
    end if;
  end if;

  if new.tipo_movimentacao = 'saida_clinica' and coalesce(new.destino_tipo, '') <> 'clinica' then
    raise exception 'Saída para clínica exige destino do tipo clínica.';
  end if;

  if new.tipo_movimentacao = 'saida_setor' and coalesce(new.destino_tipo, '') <> 'setor' then
    raise exception 'Saída para setor exige destino do tipo setor.';
  end if;

  if new.tipo_movimentacao = 'transferencia' then
    if new.origem_tipo is null or new.destino_tipo is null then
      raise exception 'Transferência exige origem e destino.';
    end if;
  end if;

  if new.tipo_movimentacao in ('saida_clinica', 'saida_setor', 'transferencia', 'ajuste_negativo', 'descarte') then
    if produto_row.quantidade_atual < new.quantidade then
      raise exception 'Saldo insuficiente para a movimentação.';
    end if;
    current_cost := coalesce(produto_row.custo_medio_atual, 0);
    if new.custo_unitario is null and current_cost > 0 then
      new.custo_unitario := current_cost;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_parque_before_insert_movimentacao on public.parque_movimentacoes;
create trigger trg_parque_before_insert_movimentacao
before insert on public.parque_movimentacoes
for each row execute function public.parque_before_insert_movimentacao();
create or replace function public.parque_after_insert_movimentacao()
returns trigger
language plpgsql
as $$
declare
  produto_row public.parque_produtos%rowtype;
  next_quantity numeric(14,2);
  next_cost numeric(14,2);
  total_cost_acc numeric(14,2);
  clinic_movement_id uuid;
  clinic_label text;
begin
  select * into produto_row
  from public.parque_produtos
  where id = new.produto_id
  for update;

  if public.parque_tipo_delta(new.tipo_movimentacao) = 1 then
    next_quantity := coalesce(produto_row.quantidade_atual, 0) + new.quantidade;
    if coalesce(new.custo_unitario, 0) > 0 then
      total_cost_acc := (coalesce(produto_row.quantidade_atual, 0) * coalesce(produto_row.custo_medio_atual, 0)) + (new.quantidade * new.custo_unitario);
      next_cost := case when next_quantity > 0 then round((total_cost_acc / next_quantity)::numeric, 2) else 0 end;
    else
      next_cost := coalesce(produto_row.custo_medio_atual, 0);
    end if;
  else
    next_quantity := coalesce(produto_row.quantidade_atual, 0) - new.quantidade;
    if next_quantity < 0 then
      raise exception 'Saldo negativo não permitido.';
    end if;
    next_cost := case when next_quantity = 0 then coalesce(produto_row.custo_medio_atual, 0) else coalesce(produto_row.custo_medio_atual, 0) end;
  end if;

  update public.parque_produtos
  set quantidade_atual = next_quantity,
      custo_medio_atual = next_cost,
      updated_at = now()
  where id = new.produto_id;

  if new.tipo_movimentacao = 'saida_clinica' then
    clinic_label := coalesce(new.destino_descricao, 'Clinica');
    insert into public.custos_clinicas_movements (
      competencia,
      clinic,
      product,
      store,
      quantity,
      unit_cost,
      total_cost,
      created_by,
      created_at
    ) values (
      date_trunc('month', new.data_movimentacao)::date,
      clinic_label,
      coalesce(public.parque_produto_label(new.produto_id), 'Produto'),
      coalesce(nullif(new.origem_descricao, ''), 'PARQUE TECNOLOGICO'),
      round(new.quantidade)::integer,
      coalesce(new.custo_unitario, 0),
      round((new.quantidade * coalesce(new.custo_unitario, 0))::numeric, 2),
      new.created_by,
      now()
    ) returning id into clinic_movement_id;

    update public.parque_movimentacoes
    set custo_clinica_id = clinic_movement_id
    where id = new.id;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_parque_after_insert_movimentacao on public.parque_movimentacoes;
create trigger trg_parque_after_insert_movimentacao
after insert on public.parque_movimentacoes
for each row execute function public.parque_after_insert_movimentacao();

create or replace function public.parque_create_produto(
  p_item_base_id uuid,
  p_categoria text,
  p_especificacao_valor text default null,
  p_unidade_base_id uuid default null,
  p_marca_base_id uuid default null,
  p_quantidade_inicial numeric default 0,
  p_quantidade_minima numeric default null,
  p_ativo boolean default true,
  p_observacao text default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  produto_id uuid;
begin
  if has_module_edit_access('parque_tecnologico') is not true then
    raise exception 'Sem permissão para cadastrar produtos.';
  end if;

  insert into public.parque_produtos (
    item_base_id,
    categoria,
    especificacao_valor,
    unidade_base_id,
    marca_base_id,
    quantidade_atual,
    quantidade_minima,
    ativo,
    created_by
  ) values (
    p_item_base_id,
    upper(trim(coalesce(p_categoria, ''))),
    nullif(upper(trim(coalesce(p_especificacao_valor, ''))), ''),
    p_unidade_base_id,
    p_marca_base_id,
    0,
    p_quantidade_minima,
    coalesce(p_ativo, true),
    auth.uid()
  ) returning id into produto_id;

  if coalesce(p_quantidade_inicial, 0) > 0 then
    insert into public.parque_movimentacoes (
      produto_id,
      tipo_movimentacao,
      origem_tipo,
      origem_descricao,
      destino_tipo,
      destino_descricao,
      quantidade,
      data_movimentacao,
      observacao,
      created_by
    ) values (
      produto_id,
      'entrada_manual',
      'estoque',
      'ESTOQUE INICIAL',
      'estoque',
      'PARQUE TECNOLOGICO',
      p_quantidade_inicial,
      now(),
      coalesce(nullif(p_observacao, ''), 'Entrada inicial do produto'),
      auth.uid()
    );
  end if;

  return produto_id;
end;
$$;

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
    raise exception 'Sem permissão para registrar movimentações.';
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
end;
$$;
create or replace function public.parque_registrar_descarte(
  p_produto_id uuid,
  p_quantidade numeric,
  p_data_descarte timestamptz default now(),
  p_motivo text default null,
  p_observacao text default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  movement_id uuid;
  discard_id uuid;
begin
  if has_module_edit_access('parque_tecnologico') is not true then
    raise exception 'Sem permissão para registrar descarte.';
  end if;

  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'Motivo do descarte é obrigatório.';
  end if;

  movement_id := public.parque_registrar_movimentacao(
    p_produto_id,
    'descarte',
    p_quantidade,
    'estoque',
    null,
    'PARQUE TECNOLOGICO',
    'descarte',
    null,
    p_motivo,
    coalesce(p_data_descarte, now()),
    p_observacao,
    null,
    null
  );

  insert into public.parque_descartes (
    produto_id,
    data_descarte,
    quantidade,
    motivo,
    observacao,
    movimentacao_id,
    created_by
  ) values (
    p_produto_id,
    coalesce(p_data_descarte, now()),
    p_quantidade,
    p_motivo,
    nullif(p_observacao, ''),
    movement_id,
    auth.uid()
  ) returning id into discard_id;

  return discard_id;
end;
$$;

create or replace function public.parque_list_pedidos_entregues()
returns table (
  id uuid,
  ano integer,
  mes integer,
  item text,
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
    m.quantidade,
    m.valor_unit,
    m.valor_total_frete,
    m.setor,
    m.protocolo_id,
    m.protocolo_item_id,
    concat_ws(' • ',
      concat(lpad(m.mes::text, 2, '0'), '/', m.ano::text),
      m.item,
      concat('Qtd ', trim(to_char(m.quantidade, 'FM999999990.00')))
    ) as origem_label
  from public.pc_mensal_itens m
  where m.status = 'ENTREGUE'
    and not exists (
      select 1
      from public.parque_movimentacoes pm
      where pm.pedido_compra_id = m.id
        and pm.tipo_movimentacao = 'entrada_compra'
    )
  order by m.ano desc, m.mes desc, m.created_at desc;
$$;

grant execute on function public.parque_user_role() to authenticated;
grant execute on function public.parque_can_adjust() to authenticated;
grant execute on function public.parque_tipo_delta(text) to authenticated;
grant execute on function public.parque_produto_label(uuid) to authenticated;
grant execute on function public.parque_create_produto(uuid, text, text, uuid, uuid, numeric, numeric, boolean, text) to authenticated;
grant execute on function public.parque_registrar_movimentacao(uuid, text, numeric, text, uuid, text, text, uuid, text, timestamptz, text, uuid, numeric) to authenticated;
grant execute on function public.parque_registrar_descarte(uuid, numeric, timestamptz, text, text) to authenticated;
grant execute on function public.parque_list_pedidos_entregues() to authenticated;

alter table public.parque_itens_base enable row level security;
alter table public.parque_unidades_base enable row level security;
alter table public.parque_marcas_base enable row level security;
alter table public.parque_produtos enable row level security;
alter table public.parque_movimentacoes enable row level security;
alter table public.parque_descartes enable row level security;

drop policy if exists parque_itens_base_read on public.parque_itens_base;
create policy parque_itens_base_read on public.parque_itens_base for select to authenticated using (has_module_access('parque_tecnologico'));
drop policy if exists parque_itens_base_manage on public.parque_itens_base;
create policy parque_itens_base_manage on public.parque_itens_base for all to authenticated using (has_module_edit_access('parque_tecnologico')) with check (has_module_edit_access('parque_tecnologico'));

drop policy if exists parque_unidades_base_read on public.parque_unidades_base;
create policy parque_unidades_base_read on public.parque_unidades_base for select to authenticated using (has_module_access('parque_tecnologico'));
drop policy if exists parque_unidades_base_manage on public.parque_unidades_base;
create policy parque_unidades_base_manage on public.parque_unidades_base for all to authenticated using (has_module_edit_access('parque_tecnologico')) with check (has_module_edit_access('parque_tecnologico'));

drop policy if exists parque_marcas_base_read on public.parque_marcas_base;
create policy parque_marcas_base_read on public.parque_marcas_base for select to authenticated using (has_module_access('parque_tecnologico'));
drop policy if exists parque_marcas_base_manage on public.parque_marcas_base;
create policy parque_marcas_base_manage on public.parque_marcas_base for all to authenticated using (has_module_edit_access('parque_tecnologico')) with check (has_module_edit_access('parque_tecnologico'));

drop policy if exists parque_produtos_read on public.parque_produtos;
create policy parque_produtos_read on public.parque_produtos for select to authenticated using (has_module_access('parque_tecnologico'));
drop policy if exists parque_produtos_manage on public.parque_produtos;
create policy parque_produtos_manage on public.parque_produtos for all to authenticated using (has_module_edit_access('parque_tecnologico')) with check (has_module_edit_access('parque_tecnologico'));

drop policy if exists parque_movimentacoes_read on public.parque_movimentacoes;
create policy parque_movimentacoes_read on public.parque_movimentacoes for select to authenticated using (has_module_access('parque_tecnologico'));

drop policy if exists parque_descartes_read on public.parque_descartes;
create policy parque_descartes_read on public.parque_descartes for select to authenticated using (has_module_access('parque_tecnologico'));

create or replace function set_modules_by_role()
returns trigger as $$
declare
  default_modules text[];
begin
  case new.role
    when 'owner' then
      default_modules := array['usuarios','acessos','pessoal','teams','win_users','rateio_claro','rateio_google','contas_a_pagar','rateio_mkm','controle_empresas','controle_uber','visitas_clinicas','pedidos_de_compra','custos_clinicas','parque_tecnologico'];
    when 'admin' then
      default_modules := array['usuarios','acessos','pessoal','teams','win_users','rateio_claro','rateio_google','contas_a_pagar','rateio_mkm','controle_empresas','controle_uber','visitas_clinicas','pedidos_de_compra','custos_clinicas','parque_tecnologico'];
    when 'financeiro' then
      default_modules := array['rateio_claro','rateio_google','rateio_mkm','controle_empresas','visitas_clinicas','custos_clinicas','contas_a_pagar','pedidos_de_compra','controle_uber','parque_tecnologico'];
    when 'usuario' then
      default_modules := array['acessos','pessoal','teams','win_users'];
    else
      default_modules := array[]::text[];
  end case;

  if tg_op = 'insert' then
    if new.modules is null or array_length(new.modules, 1) is null then new.modules := default_modules; end if;
    if new.edit_modules is null or array_length(new.edit_modules, 1) is null then new.edit_modules := new.modules; end if;
  elsif tg_op = 'update' then
    if new.role is distinct from old.role then
      if new.modules is distinct from old.modules or new.edit_modules is distinct from old.edit_modules then null;
      else new.modules := default_modules; new.edit_modules := default_modules; end if;
    else
      if new.modules is null then new.modules := old.modules; end if;
      if new.edit_modules is null then new.edit_modules := old.edit_modules; end if;
    end if;
  end if;

  new.modules := coalesce((select array_agg(m order by m) from (select distinct module_name as m from unnest(coalesce(new.modules, array[]::text[])) module_name where module_name is not null and btrim(module_name) <> '') modules_set), array[]::text[]);
  new.edit_modules := coalesce((select array_agg(m order by m) from (select distinct edit_name as m from unnest(coalesce(new.edit_modules, array[]::text[])) edit_name where edit_name is not null and btrim(edit_name) <> '' and edit_name = any(new.modules)) edit_set), array[]::text[]);
  return new;
end;
$$ language plpgsql;

update public.users
set modules = array_append(coalesce(modules, array[]::text[]), 'parque_tecnologico')
where role in ('owner','admin','financeiro')
  and not (coalesce(modules, array[]::text[]) @> array['parque_tecnologico']);

update public.users
set edit_modules = array_append(coalesce(edit_modules, array[]::text[]), 'parque_tecnologico')
where role in ('owner','admin','financeiro')
  and not (coalesce(edit_modules, array[]::text[]) @> array['parque_tecnologico']);
create or replace function handle_new_auth_user()
returns trigger as $$
declare
  user_role text := 'usuario';
  user_modules text[] := array['acessos', 'pessoal', 'teams', 'win_users'];
  user_name text;
  user_password text := '';
begin
  if new.raw_user_meta_data is not null then
    if new.raw_user_meta_data ? 'role' then user_role := new.raw_user_meta_data->>'role'; end if;
    if new.raw_user_meta_data ? 'name' then user_name := new.raw_user_meta_data->>'name'; end if;
    if new.raw_user_meta_data ? 'password' then user_password := new.raw_user_meta_data->>'password'; end if;
  end if;

  if user_name is null or user_name = '' then
    user_name := split_part(new.email, '@', 1);
  end if;

  case user_role
    when 'owner' then
      user_modules := array['usuarios','acessos','pessoal','teams','win_users','rateio_claro','rateio_google','contas_a_pagar','rateio_mkm','controle_empresas','controle_uber','visitas_clinicas','pedidos_de_compra','custos_clinicas','parque_tecnologico'];
    when 'admin' then
      user_modules := array['usuarios','acessos','pessoal','teams','win_users','rateio_claro','rateio_google','contas_a_pagar','rateio_mkm','controle_empresas','controle_uber','visitas_clinicas','pedidos_de_compra','custos_clinicas','parque_tecnologico'];
    when 'financeiro' then
      user_modules := array['rateio_claro','rateio_google','rateio_mkm','controle_empresas','visitas_clinicas','custos_clinicas','contas_a_pagar','pedidos_de_compra','controle_uber','parque_tecnologico'];
    when 'usuario' then
      user_modules := array['acessos','pessoal','teams','win_users'];
    else
      user_modules := array['acessos','pessoal','teams','win_users'];
  end case;

  insert into public.users (
    email,
    name,
    role,
    modules,
    edit_modules,
    is_active,
    auth_uid,
    pass,
    created_at,
    updated_at
  ) values (
    new.email,
    user_name,
    user_role,
    user_modules,
    user_modules,
    true,
    new.id,
    user_password,
    now(),
    now()
  ) on conflict (auth_uid) do update set
    email = excluded.email,
    name = coalesce(excluded.name, users.name),
    role = excluded.role,
    modules = excluded.modules,
    edit_modules = excluded.edit_modules,
    is_active = excluded.is_active,
    pass = excluded.pass,
    updated_at = now();

  return new;
end;
$$ language plpgsql security definer;
