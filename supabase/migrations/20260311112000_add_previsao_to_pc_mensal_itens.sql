/*
  # Add previsao to monthly purchase items

  Enables the "Previsao" date field used in Pedidos de Compra > Mensal.
*/

alter table public.pc_mensal_itens
  add column if not exists previsao date;
