/*
  # Fix RLS Policies for Production - Ajuste da policy de insert no users

  1. Users Table Policies
    - Corrige policy para permitir inserção apenas por usuários com role admin
    - Permite leitura e atualização apenas do próprio usuário
  2. Mantém outras policies para módulos conforme já configuradas
*/

/* Removendo policies antigas que possam conflitar */
DROP POLICY IF EXISTS "Allow authenticated users to insert" ON users;

/* Policy corrigida para permitir inserção apenas para usuários admin */
CREATE POLICY "Allow authenticated users to insert"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.role() = 'admin');

/* Permitir que usuários leiam seus próprios dados */
DROP POLICY IF EXISTS "Allow users to read their own record" ON users;
CREATE POLICY "Allow users to read their own record"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

/* Permitir que usuários atualizem seus próprios dados */
DROP POLICY IF EXISTS "Allow users to update their own record" ON users;
CREATE POLICY "Allow users to update their own record"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

/* Permitir leitura do próprio perfil pelo auth_uid */
DROP POLICY IF EXISTS "Can read own profile" ON users;
CREATE POLICY "Can read own profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = auth_uid);

/* Permitir que usuários selecionem a si mesmos */
DROP POLICY IF EXISTS "users_can_select_themselves" ON users;
CREATE POLICY "users_can_select_themselves"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth_uid = auth.uid());

