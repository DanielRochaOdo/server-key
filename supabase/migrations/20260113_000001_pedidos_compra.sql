-- =========================================
-- PEDIDOS DE COMPRA (MENSAL + PROTOCOLOS)
-- =========================================

-- 1) ENUMS
do $$ begin
  if not exists (select 1 from pg_type where typname = 'pc_status_mensal') then
    create type public.pc_status_mensal as enum ('ENTREGUE', 'PEDIDO_FEITO');
  end if;

  if not exists (select 1 from pg_type where typname = 'pc_prioridade') then
    create type public.pc_prioridade as enum ('BAIXA', 'MEDIA', 'ALTA');
  end if;

  if not exists (select 1 from pg_type where typname = 'pc_status_protocolo') then
    create type public.pc_status_protocolo as enum ('RASCUNHO', 'SALVO');
  end if;
end $$;

-- 2) TABELA: PROTOCOLOS
create table if not exists public.pc_protocolos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  nome text not null unique, -- TITULO_DD-MM-AAAA (gerado no insert)
  ano int not null,
  mes int not null check (mes between 1 and 12),
  status public.pc_status_protocolo not null default 'RASCUNHO',
  valor_final numeric(12,2) not null default 0,
  criado_por uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pc_protocolos_ano_mes_idx
  on public.pc_protocolos (ano, mes);

-- 3) TABELA: ITENS DO PROTOCOLO
create table if not exists public.pc_protocolo_itens (
  id uuid primary key default gen_random_uuid(),
  protocolo_id uuid not null references public.pc_protocolos(id) on delete cascade,
  loja text not null,
  produto text not null,
  prioridade public.pc_prioridade not null default 'MEDIA',
  quantidade numeric(12,2) not null default 0,
  valor_unit numeric(12,2) not null default 0,
  valor_total numeric(12,2) generated always as (round((quantidade * valor_unit)::numeric, 2)) stored,
  link text null,
  diretoria boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pc_protocolo_itens_protocolo_idx
  on public.pc_protocolo_itens (protocolo_id);

-- 4) TABELA: MENSAL (CONSOLIDADO DO MÊS/ANO)
create table if not exists public.pc_mensal_itens (
  id uuid primary key default gen_random_uuid(),
  ano int not null,
  mes int not null check (mes between 1 and 12),
  item text not null,
  quantidade numeric(12,2) not null default 0,
  valor_unit numeric(12,2) not null default 0,
  valor_total_frete numeric(12,2) not null default 0, -- "VALOR TOTAL + FRETE"
  setor text null,
  status public.pc_status_mensal not null default 'PEDIDO_FEITO',
  diretoria boolean not null default false,

  -- vínculo opcional ao protocolo (pra rastrear origem)
  protocolo_id uuid null references public.pc_protocolos(id) on delete set null,
  protocolo_item_id uuid null references public.pc_protocolo_itens(id) on delete set null,

  criado_por uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pc_mensal_ano_mes_idx
  on public.pc_mensal_itens (ano, mes);

-- impede duplicar o mesmo item do protocolo indo várias vezes pro mensal
create unique index if not exists pc_mensal_unique_protocolo_item
  on public.pc_mensal_itens (protocolo_item_id)
  where protocolo_item_id is not null;

-- 5) UPDATED_AT helpers
create or replace function public.pc_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_pc_protocolos_updated_at on public.pc_protocolos;
create trigger trg_pc_protocolos_updated_at
before update on public.pc_protocolos
for each row execute function public.pc_set_updated_at();

drop trigger if exists trg_pc_protocolo_itens_updated_at on public.pc_protocolo_itens;
create trigger trg_pc_protocolo_itens_updated_at
before update on public.pc_protocolo_itens
for each row execute function public.pc_set_updated_at();

drop trigger if exists trg_pc_mensal_itens_updated_at on public.pc_mensal_itens;
create trigger trg_pc_mensal_itens_updated_at
before update on public.pc_mensal_itens
for each row execute function public.pc_set_updated_at();

-- 6) GERAR "nome" do protocolo: TITULO_DD-MM-AAAA
create or replace function public.pc_generate_protocol_name()
returns trigger
language plpgsql
as $$
declare
  d text;
  t text;
begin
  -- sanitiza título pra nome (mantém letras/números/espaço/_/-)
  t := regexp_replace(trim(new.titulo), '[^a-zA-Z0-9 _-]+', '', 'g');

  d := to_char(now() at time zone 'America/Fortaleza', 'DD-MM-YYYY');
  new.nome := t || '_' || d;

  -- define ano/mes se vierem nulos (segurança)
  if new.ano is null then
    new.ano := extract(year from (now() at time zone 'America/Fortaleza'))::int;
  end if;
  if new.mes is null then
    new.mes := extract(month from (now() at time zone 'America/Fortaleza'))::int;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_pc_protocolos_name on public.pc_protocolos;
create trigger trg_pc_protocolos_name
before insert on public.pc_protocolos
for each row execute function public.pc_generate_protocol_name();

-- 7) RECALCULAR VALOR_FINAL DO PROTOCOLO QUANDO ITENS MUDAM
create or replace function public.pc_recalc_protocol_total(p_protocolo_id uuid)
returns void
language plpgsql
as $$
begin
  update public.pc_protocolos p
  set valor_final = coalesce((
    select round(sum(i.valor_total)::numeric, 2)
    from public.pc_protocolo_itens i
    where i.protocolo_id = p_protocolo_id
  ), 0)
  where p.id = p_protocolo_id;
end;
$$;

create or replace function public.pc_protocol_items_after_change()
returns trigger
language plpgsql
as $$
declare
  pid uuid;
begin
  pid := coalesce(new.protocolo_id, old.protocolo_id);
  perform public.pc_recalc_protocol_total(pid);
  return null;
end;
$$;

drop trigger if exists trg_pc_protocolo_itens_after_change on public.pc_protocolo_itens;
create trigger trg_pc_protocolo_itens_after_change
after insert or update or delete on public.pc_protocolo_itens
for each row execute function public.pc_protocol_items_after_change();

-- 8) AO SALVAR PROTOCOLO -> COPIAR ITENS PARA MENSAL COM STATUS 'PEDIDO_FEITO'
create or replace function public.pc_copy_to_mensal_on_save()
returns trigger
language plpgsql
as $$
begin
  -- só quando muda para SALVO
  if (old.status is distinct from new.status) and (new.status = 'SALVO') then
    insert into public.pc_mensal_itens (
      ano, mes, item, quantidade, valor_unit, valor_total_frete,
      setor, status, diretoria, protocolo_id, protocolo_item_id
    )
    select
      new.ano,
      new.mes,
      i.produto as item,
      i.quantidade,
      i.valor_unit,
      i.valor_total as valor_total_frete, -- frete pode ser ajustado no mensal
      'TI' as setor,
      'PEDIDO_FEITO'::public.pc_status_mensal,
      i.diretoria as diretoria,
      new.id,
      i.id
    from public.pc_protocolo_itens i
    where i.protocolo_id = new.id
    on conflict (protocolo_item_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_pc_copy_to_mensal on public.pc_protocolos;
create trigger trg_pc_copy_to_mensal
after update on public.pc_protocolos
for each row execute function public.pc_copy_to_mensal_on_save();

-- 9) VIEW PARA TOTAIS DO MENSAL
create or replace view public.pc_mensal_totais as
select
  ano,
  mes,
  round(coalesce(sum(valor_total_frete) filter (where status = 'ENTREGUE'), 0)::numeric, 2) as total_entregue,
  round(coalesce(sum(valor_total_frete) filter (where status in ('ENTREGUE','PEDIDO_FEITO')), 0)::numeric, 2) as total_aprovado
from public.pc_mensal_itens
group by ano, mes;

-- 10) RLS
alter table public.pc_protocolos enable row level security;
alter table public.pc_protocolo_itens enable row level security;
alter table public.pc_mensal_itens enable row level security;

-- Políticas simples: autenticado pode CRUD
drop policy if exists "pc_protocolos_auth_all" on public.pc_protocolos;
create policy "pc_protocolos_auth_all"
on public.pc_protocolos
for all
to authenticated
using (true)
with check (true);

drop policy if exists "pc_protocolo_itens_auth_all" on public.pc_protocolo_itens;
create policy "pc_protocolo_itens_auth_all"
on public.pc_protocolo_itens
for all
to authenticated
using (true)
with check (true);

drop policy if exists "pc_mensal_itens_auth_all" on public.pc_mensal_itens;
create policy "pc_mensal_itens_auth_all"
on public.pc_mensal_itens
for all
to authenticated
using (true)
with check (true);
