/*
  # Corrigir políticas RLS da tabela pessoal

  1. Security Changes
    - Remove políticas existentes que permitem acesso amplo
    - Criar política restritiva que permite apenas acesso aos próprios dados
    - Garantir que senhas sejam visíveis apenas para o dono dos dados

  2. Changes
    - DROP das políticas atuais
    - CREATE de nova política mais restritiva
    - Verificação dupla: auth.uid() = user_id
*/

-- Remove políticas existentes
DROP POLICY IF EXISTS "pessoal_module_read" ON pessoal;
DROP POLICY IF EXISTS "pessoal_module_manage_own" ON pessoal;
DROP POLICY IF EXISTS "pessoal_own_data_only" ON pessoal;

-- Cria política restritiva - usuário só acessa seus próprios dados
CREATE POLICY "pessoal_own_data_only"
  ON pessoal
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);