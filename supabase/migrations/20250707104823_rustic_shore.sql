/*
  # Sistema RBAC para usuários

  1. Reestruturação da tabela users
    - Adicionar auth_uid para vincular com auth.users
    - Atualizar role com novos valores (admin, financeiro, usuario)
    - Substituir permissions por modules (array de módulos permitidos)
    - Adicionar campo pass para armazenar senha temporariamente

  2. Políticas de segurança (RLS)
    - Apenas admin pode gerenciar usuários
    - Usuários podem ler seus próprios dados
    - Admin pode ler todos os dados

  3. Índices para performance
    - Índice único em auth_uid
    - Índices em campos frequentemente consultados
*/

-- Primeiro, vamos fazer backup dos dados existentes se houver
DO $$
BEGIN
  -- Criar tabela temporária para backup se users existir
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users') THEN
    CREATE TEMP TABLE users_backup AS SELECT * FROM users;
  END IF;
END $$;

-- Recriar a tabela users com a nova estrutura
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'usuario' CHECK (role IN ('admin', 'financeiro', 'usuario')),
  modules text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  auth_uid uuid UNIQUE,
  pass text NOT NULL DEFAULT ''
);

-- Criar índices para performance
CREATE UNIQUE INDEX idx_users_auth_uid_unique ON users(auth_uid);
CREATE INDEX idx_users_auth_uid ON users(auth_uid);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_users_created_at ON users(created_at);

-- Habilitar RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Função auxiliar para verificar se o usuário é admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE auth_uid = auth.uid() 
    AND role = 'admin' 
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Políticas RLS

-- Admin pode inserir usuários
CREATE POLICY "Admin can insert users"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- Usuários podem ler seus próprios dados ou admin pode ler todos
CREATE POLICY "Users can read their data or admin can read all"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    role = 'admin' OR auth.uid() = auth_uid
  );

-- Usuários podem atualizar seus próprios dados ou admin pode atualizar todos
CREATE POLICY "Users can update their data or admin can update all"
  ON users
  FOR UPDATE
  TO authenticated
  USING (
    role = 'admin' OR auth.uid() = auth_uid
  )
  WITH CHECK (
    role = 'admin' OR auth.uid() = auth_uid
  );

-- Função para definir módulos baseado no role
CREATE OR REPLACE FUNCTION set_modules_by_role()
RETURNS TRIGGER AS $$
BEGIN
  CASE NEW.role
    WHEN 'admin' THEN
      NEW.modules := ARRAY['usuarios', 'acessos', 'teams', 'win_users', 'rateio_claro', 'rateio_google'];
    WHEN 'financeiro' THEN
      NEW.modules := ARRAY['rateio_claro', 'rateio_google'];
    WHEN 'usuario' THEN
      NEW.modules := ARRAY['acessos', 'teams', 'win_users'];
    ELSE
      NEW.modules := ARRAY[]::text[];
  END CASE;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para definir módulos automaticamente baseado no role
DROP TRIGGER IF EXISTS set_modules_on_role_change ON users;
CREATE TRIGGER set_modules_on_role_change
  BEFORE INSERT OR UPDATE OF role ON users
  FOR EACH ROW
  EXECUTE FUNCTION set_modules_by_role();

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Inserir usuário admin padrão
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE lower(email) = lower('admin@serverkey.com')) THEN
    INSERT INTO users (email, name, role, is_active, pass) VALUES (
      'admin@serverkey.com',
      'Administrador',
      'admin',
      true,
      'admin123'
    );
  END IF;
END $$;

-- Atualizar políticas nas outras tabelas para usar o novo sistema de módulos

-- Política para acessos
DROP POLICY IF EXISTS "Todos podem ler" ON acessos;
DROP POLICY IF EXISTS "Users can manage their own access data" ON acessos;

CREATE POLICY "Users with acessos module can read"
  ON acessos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE auth_uid = auth.uid() 
      AND 'acessos' = ANY(modules)
      AND is_active = true
    )
  );

CREATE POLICY "Users with acessos module can manage their own data"
  ON acessos
  FOR ALL
  TO authenticated
  USING (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE auth_uid = auth.uid() 
      AND 'acessos' = ANY(modules)
      AND is_active = true
    )
  )
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE auth_uid = auth.uid() 
      AND 'acessos' = ANY(modules)
      AND is_active = true
    )
  );

-- Política para teams
DROP POLICY IF EXISTS "Allow select for authenticated" ON teams;
DROP POLICY IF EXISTS "Allow insert for authenticated" ON teams;
DROP POLICY IF EXISTS "Users can manage their own teams data" ON teams;

CREATE POLICY "Users with teams module can read"
  ON teams
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE auth_uid = auth.uid() 
      AND 'teams' = ANY(modules)
      AND is_active = true
    )
  );

CREATE POLICY "Users with teams module can manage their own data"
  ON teams
  FOR ALL
  TO authenticated
  USING (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE auth_uid = auth.uid() 
      AND 'teams' = ANY(modules)
      AND is_active = true
    )
  )
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE auth_uid = auth.uid() 
      AND 'teams' = ANY(modules)
      AND is_active = true
    )
  );

-- Política para rateio_claro
DROP POLICY IF EXISTS "Todos podem ler rateio claro" ON rateio_claro;
DROP POLICY IF EXISTS "Users can manage their own rateio claro data" ON rateio_claro;

CREATE POLICY "Users with rateio_claro module can read"
  ON rateio_claro
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE auth_uid = auth.uid() 
      AND 'rateio_claro' = ANY(modules)
      AND is_active = true
    )
  );

CREATE POLICY "Users with rateio_claro module can manage their own data"
  ON rateio_claro
  FOR ALL
  TO authenticated
  USING (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE auth_uid = auth.uid() 
      AND 'rateio_claro' = ANY(modules)
      AND is_active = true
    )
  )
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE auth_uid = auth.uid() 
      AND 'rateio_claro' = ANY(modules)
      AND is_active = true
    )
  );

-- Política para rateio_google
DROP POLICY IF EXISTS "Todos podem ler rateio google" ON rateio_google;
DROP POLICY IF EXISTS "Users can manage their own rateio google data" ON rateio_google;

CREATE POLICY "Users with rateio_google module can read"
  ON rateio_google
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE auth_uid = auth.uid() 
      AND 'rateio_google' = ANY(modules)
      AND is_active = true
    )
  );

CREATE POLICY "Users with rateio_google module can manage their own data"
  ON rateio_google
  FOR ALL
  TO authenticated
  USING (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE auth_uid = auth.uid() 
      AND 'rateio_google' = ANY(modules)
      AND is_active = true
    )
  )
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE auth_uid = auth.uid() 
      AND 'rateio_google' = ANY(modules)
      AND is_active = true
    )
  );
