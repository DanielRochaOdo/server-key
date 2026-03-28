set search_path = public;

with destinos_fixos(nome) as (
  values
    ('PARQUE TECNOLOGICO'),
    ('AGUANAMBI'),
    ('BEZERRA'),
    ('PARANGABA'),
    ('SOBRAL'),
    ('MATRIZ - TI'),
    ('MATRIZ - ADM'),
    ('MATRIZ - CALL CENTER'),
    ('MATRIZ - CREDENCIAMENTO'),
    ('MATRIZ - FINANCEIRO'),
    ('MATRIZ - DP'),
    ('MATRIZ - RH')
)
insert into public.parque_parametros_base (categoria, nome, ativo)
select 'destino_descricao', d.nome, true
from destinos_fixos d
where not exists (
  select 1
  from public.parque_parametros_base p
  where p.categoria = 'destino_descricao'
    and lower(trim(p.nome)) = lower(trim(d.nome))
);

with setores_fixos(nome) as (
  values
    ('TI'),
    ('ADM'),
    ('CALL CENTER'),
    ('CREDENCIAMENTO'),
    ('FINANCEIRO'),
    ('DP'),
    ('RH')
)
insert into public.parque_parametros_base (categoria, nome, ativo)
select 'setor', s.nome, true
from setores_fixos s
where not exists (
  select 1
  from public.parque_parametros_base p
  where p.categoria = 'setor'
    and lower(trim(p.nome)) = lower(trim(s.nome))
);

with origens_fixas(nome) as (
  values
    ('compra'),
    ('pre-cadastro')
)
insert into public.parque_parametros_base (categoria, nome, ativo)
select 'origem_tipo', o.nome, true
from origens_fixas o
where not exists (
  select 1
  from public.parque_parametros_base p
  where p.categoria = 'origem_tipo'
    and lower(trim(p.nome)) = lower(trim(o.nome))
);

with tipos_destino_fixos(nome) as (
  values
    ('estoque'),
    ('clinica'),
    ('setor'),
    ('descarte')
)
insert into public.parque_parametros_base (categoria, nome, ativo)
select 'destino_tipo', d.nome, true
from tipos_destino_fixos d
where not exists (
  select 1
  from public.parque_parametros_base p
  where p.categoria = 'destino_tipo'
    and lower(trim(p.nome)) = lower(trim(d.nome))
);
