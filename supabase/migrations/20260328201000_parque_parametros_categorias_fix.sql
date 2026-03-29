set search_path = public;

alter table if exists public.parque_parametros_base
  drop constraint if exists parque_parametros_base_categoria_check;

alter table if exists public.parque_parametros_base
  add constraint parque_parametros_base_categoria_check
  check (
    categoria in (
      'categoria_produto',
      'especificacao_produto',
      'tipo_movimentacao',
      'origem_tipo',
      'destino_tipo',
      'destino_descricao'
    )
  );

update public.parque_parametros_base
set nome = 'PARQUE TECNOLÓGICO'
where categoria = 'destino_descricao'
  and nome in ('PARQUE TECNOLÃ“GICO', 'PARQUE TECNOLOGICO');
