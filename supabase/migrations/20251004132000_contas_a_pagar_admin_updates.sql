/*
  # [20251004132000] Allow usuários com acesso ao módulo “contas_a_pagar” a atualizarem e excluírem registros

  A policy antiga exigia que o `user_id` do registro correspondesse ao UID da sessão para QUALQUER
  operação. Isso impedia administradores e membros do financeiro de alternarem o status de contas
  cadastradas por outras pessoas, gerando o alerta "Erro ao atualizar status do documento".

  Esta migration:
    1. Remove a policy “manage their own data”.
    2. Cria policies separadas para INSERT (mantendo o `user_id = auth.uid()`), UPDATE e DELETE,
       permitindo que quem tem acesso ao módulo atualize/exclua qualquer registro enquanto mantemos
       a verificação do módulo.
    3. Mantém a policy de SELECT original.
*/

DROP POLICY IF EXISTS "Users with contas a pagar module can manage their own data" ON contas_a_pagar;

CREATE POLICY "Users with contas a pagar module can insert their own data"
  ON contas_a_pagar
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND has_module_access('contas_a_pagar'));

CREATE POLICY "Users with contas a pagar module can update entries"
  ON contas_a_pagar
  FOR UPDATE
  TO authenticated
  USING (has_module_access('contas_a_pagar'))
  WITH CHECK (has_module_access('contas_a_pagar'));

CREATE POLICY "Users with contas a pagar module can delete entries"
  ON contas_a_pagar
  FOR DELETE
  TO authenticated
  USING (has_module_access('contas_a_pagar'));
