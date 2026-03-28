set search_path = public;

create extension if not exists unaccent;

create or replace function public.parque_normalizar_texto(p_texto text)
returns text
language sql
stable
as $$
  select regexp_replace(
    upper(trim(unaccent(coalesce(p_texto, '')))),
    '\s+',
    ' ',
    'g'
  );
$$;

create or replace function public.parque_is_destino_estoque(
  p_destino_tipo text,
  p_destino_descricao text
)
returns boolean
language sql
stable
as $$
  with norm as (
    select
      public.parque_normalizar_texto(p_destino_tipo) as tipo_norm,
      public.parque_normalizar_texto(p_destino_descricao) as descricao_norm
  )
  select
    (select tipo_norm from norm) in ('ESTOQUE', 'PARQUE TECNOLOGICO', 'PARQUE_TECNOLOGICO', 'PARQUE')
    or (select descricao_norm from norm) = 'PARQUE'
    or (select descricao_norm from norm) like '%PARQUE TECNOLOG%'
    or (select descricao_norm from norm) like '%ESTOQUE%';
$$;

create or replace function public.parque_movimentacao_delta(
  p_tipo_movimentacao text,
  p_destino_tipo text,
  p_destino_descricao text
)
returns integer
language plpgsql
stable
as $$
declare
  v_tipo_norm text;
begin
  if public.parque_is_destino_estoque(p_destino_tipo, p_destino_descricao) then
    return 1;
  end if;

  v_tipo_norm := public.parque_normalizar_texto(p_tipo_movimentacao);

  if v_tipo_norm like 'ENTRADA%' or v_tipo_norm = 'AJUSTE POSITIVO' then
    return 1;
  end if;

  return -1;
end;
$$;

grant execute on function public.parque_normalizar_texto(text) to authenticated;
grant execute on function public.parque_is_destino_estoque(text, text) to authenticated;
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
