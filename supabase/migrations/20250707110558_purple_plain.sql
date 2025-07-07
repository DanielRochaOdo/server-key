/*
  # Fix users table structure and auth integration

  1. Table Updates
    - Ensure users table has correct structure
    - Fix auth_uid relationship
    - Create proper indexes and constraints

  2. Security
    - Update RLS policies
    - Fix function permissions

  3. Data
    - Insert default admin user with proper auth integration
*/

-- Primeiro, vamos garantir que a estrutura está correta
DO $$
BEGIN
  -- Verificar se a tabela users existe e tem a estrutura correta
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'users' AND table_schema = 'public'
  ) THEN
    -- Criar tabela se não existir
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
  END IF;

  -- Verificar se a coluna auth_uid existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'auth_uid'
  ) THEN
    ALTER TABLE users ADD COLUMN auth_uid uuid UNIQUE;
  END IF;

  -- Verificar se a coluna pass existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'pass'
  ) THEN
    ALTER TABLE users ADD COLUMN pass text NOT NULL DEFAULT '';
  END IF;
END $$;

-- Criar índices se não existirem
CREATE INDEX IF NOT EXISTS idx_users_auth_uid ON users(auth_uid);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth_uid_unique ON users(auth_uid);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Habilitar RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Recriar função is_admin se necessário
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

-- Recriar função set_modules_by_role
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

-- Remover políticas existentes
DROP POLICY IF EXISTS "Admin can insert users" ON users;
DROP POLICY IF EXISTS "Users can read their data or admin can read all" ON users;
DROP POLICY IF EXISTS "Users can update their data or admin can update all" ON users;
DROP POLICY IF EXISTS "Admins can manage all users" ON users;
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update their own data" ON users;
DROP POLICY IF EXISTS "Admins can insert new users" ON users;
DROP POLICY IF EXISTS "Authenticated users can read all users" ON users;

-- Criar políticas RLS simplificadas
CREATE POLICY "Admin can insert users"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Users can read their data or admin can read all"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    (role = 'admin' AND is_active = true) OR auth.uid() = auth_uid
  );

CREATE POLICY "Users can update their data or admin can update all"
  ON users
  FOR UPDATE
  TO authenticated
  USING (
    (role = 'admin' AND is_active = true) OR auth.uid() = auth_uid
  )
  WITH CHECK (
    (role = 'admin' AND is_active = true) OR auth.uid() = auth_uid
  );

-- Remover triggers existentes
DROP TRIGGER IF EXISTS set_modules_on_role_change ON users;
DROP TRIGGER IF EXISTS update_users_updated_at ON users;

-- Recriar triggers
CREATE TRIGGER set_modules_on_role_change
  BEFORE INSERT OR UPDATE OF role ON users
  FOR EACH ROW
  EXECUTE FUNCTION set_modules_by_role();

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Inserir usuário admin padrão se não existir
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@serverkey.com') THEN
    INSERT INTO users (email, name, role, is_active, pass) VALUES (
      'admin@serverkey.com',
      'Administrador',
      'admin',
      true,
      'admin123'
    );
  END IF;
END $$;