set search_path = public;

create or replace function public.parque_parametros_base_guard()
returns trigger
language plpgsql
as $$
declare
  categoria_alvo text;
  bloqueadas text[] := array['origem_tipo', 'destino_tipo', 'destino_descricao', 'setor', 'tipo_movimentacao'];
begin
  categoria_alvo := case when tg_op = 'DELETE' then old.categoria else new.categoria end;

  if categoria_alvo = any(bloqueadas) and current_user <> 'postgres' then
    raise exception 'Categoria de parametro controlada pelo sistema e bloqueada para edicao manual.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trg_parque_parametros_base_guard on public.parque_parametros_base;
create trigger trg_parque_parametros_base_guard
before insert or update or delete on public.parque_parametros_base
for each row execute function public.parque_parametros_base_guard();
