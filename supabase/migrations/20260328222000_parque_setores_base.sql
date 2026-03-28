set search_path = public;

alter table if exists public.parque_parametros_base
  drop constraint if exists parque_parametros_base_categoria_check;

alter table if exists public.parque_parametros_base
  add constraint parque_parametros_base_categoria_check
  check (
    categoria in (
      'categoria_produto',
      'especificacao_produto',
      'setor',
      'tipo_movimentacao',
      'origem_tipo',
      'destino_tipo',
      'destino_descricao'
    )
  );

insert into public.parque_parametros_base (categoria, nome, ativo)
select 'setor', 'TI', true
where not exists (
  select 1
  from public.parque_parametros_base p
  where p.categoria = 'setor'
    and lower(trim(p.nome)) = lower(trim('TI'))
);
