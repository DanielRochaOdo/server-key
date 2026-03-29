set search_path = public;

create or replace function public.parque_enforce_origem_estoque()
returns trigger
language plpgsql
as $$
begin
  if new.tipo_movimentacao in ('saida_clinica', 'saida_setor', 'descarte', 'ajuste_negativo', 'transferencia') then
    new.origem_tipo := 'estoque';
    new.origem_descricao := 'PARQUE TECNOLOGICO';
  elsif new.tipo_movimentacao = 'entrada_compra' then
    new.origem_tipo := 'compra';
  elsif new.tipo_movimentacao = 'entrada_manual' then
    new.origem_tipo := 'pre-cadastro';
    new.origem_descricao := coalesce(nullif(new.origem_descricao, ''), 'PRE-CADASTRO');
  end if;
  return new;
end;
$$;

drop trigger if exists zz_trg_parque_enforce_origem_estoque on public.parque_movimentacoes;
create trigger zz_trg_parque_enforce_origem_estoque
before insert on public.parque_movimentacoes
for each row execute function public.parque_enforce_origem_estoque();

update public.parque_movimentacoes
set
  origem_tipo = 'estoque',
  origem_descricao = 'PARQUE TECNOLOGICO'
where tipo_movimentacao in ('saida_clinica', 'saida_setor', 'descarte', 'ajuste_negativo', 'transferencia')
  and (
    coalesce(origem_tipo, '') <> 'estoque'
    or coalesce(origem_descricao, '') <> 'PARQUE TECNOLOGICO'
  );
