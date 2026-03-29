set search_path = public;

create or replace function public.parque_save_destino_parametro(
  p_destino_id uuid default null,
  p_destino_nome text default null,
  p_tipo_movimentacao_id uuid default null,
  p_ativo boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_destino_id uuid;
  v_destino_nome text;
begin
  if has_module_edit_access('parque_tecnologico') is not true then
    raise exception 'Sem permissao para gerenciar destinos do Parque Tecnologico.';
  end if;

  v_destino_nome := upper(trim(coalesce(p_destino_nome, '')));
  if v_destino_nome = '' then
    raise exception 'Informe o destino.';
  end if;

  if p_tipo_movimentacao_id is null then
    raise exception 'Selecione a acao.';
  end if;

  if not exists (
    select 1
    from public.parque_parametros_base pb
    where pb.id = p_tipo_movimentacao_id
      and pb.categoria = 'tipo_movimentacao'
  ) then
    raise exception 'Tipo de movimentacao invalido.';
  end if;

  if exists (
    select 1
    from public.parque_parametros_base pb
    where pb.categoria = 'destino_descricao'
      and lower(trim(pb.nome)) = lower(trim(v_destino_nome))
      and (p_destino_id is null or pb.id <> p_destino_id)
  ) then
    raise exception 'Ja existe um destino com este nome.';
  end if;

  if p_destino_id is null then
    insert into public.parque_parametros_base (categoria, nome, ativo)
    values ('destino_descricao', v_destino_nome, coalesce(p_ativo, true))
    returning id into v_destino_id;
  else
    update public.parque_parametros_base
       set nome = v_destino_nome,
           ativo = coalesce(p_ativo, true)
     where id = p_destino_id
       and categoria = 'destino_descricao'
    returning id into v_destino_id;

    if v_destino_id is null then
      raise exception 'Destino nao encontrado.';
    end if;
  end if;

  delete from public.parque_cadastros_link
   where origem_tipo = 'descricoes_destino'
     and origem_id = v_destino_id
     and destino_tipo = 'tipos_movimentacao';

  insert into public.parque_cadastros_link (
    origem_tipo,
    origem_id,
    destino_tipo,
    destino_id,
    ativo
  )
  values (
    'descricoes_destino',
    v_destino_id,
    'tipos_movimentacao',
    p_tipo_movimentacao_id,
    true
  )
  on conflict (origem_tipo, origem_id, destino_tipo, destino_id)
  do update
    set ativo = excluded.ativo,
        updated_at = now();

  return v_destino_id;
end;
$$;

grant execute on function public.parque_save_destino_parametro(uuid, text, uuid, boolean) to authenticated;
