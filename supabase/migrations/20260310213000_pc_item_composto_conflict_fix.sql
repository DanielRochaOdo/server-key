/*
  # Fix ON CONFLICT origem_chave em pc_mensal_itens

  O sync usa ON CONFLICT(origem_chave), que requer indice/constraint unico
  inferivel sem predicado parcial.
*/

drop index if exists public.pc_mensal_unique_origem_chave;

create unique index if not exists pc_mensal_unique_origem_chave
  on public.pc_mensal_itens (origem_chave);
