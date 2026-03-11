/*
  # Contas a pagar - campos de transferencia

  Adiciona os campos bancarios utilizados quando tipo_pagto = TRANSFERENCIA.
*/

alter table public.contas_a_pagar
  add column if not exists banco text,
  add column if not exists agencia text,
  add column if not exists conta text,
  add column if not exists tipo_de_conta text,
  add column if not exists cpf_cnpj text;
