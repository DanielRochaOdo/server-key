/*
  # Add contas a pagar module

  1. New Table
    - contas_a_pagar
      - id (uuid, primary key)
      - status_documento (text, required)
      - fornecedor (text, required)
      - descricao (text, required)
      - valor (numeric, required)
      - vencimento (date, required)
      - observacoes (text)
      - user_id (uuid, required)
      - created_at (timestamp)
      - updated_at (timestamp)

  2. Security
    - Enable RLS
    - Policies for module access

  3. Roles
    - Include contas_a_pagar in module list for admin and financeiro
*/

CREATE TABLE IF NOT EXISTS contas_a_pagar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status_documento text NOT NULL,
  fornecedor text NOT NULL,
  descricao text NOT NULL,
  valor numeric(12,2) NOT NULL,
  vencimento date NOT NULL,
  observacoes text,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE contas_a_pagar ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contas_a_pagar_status_check'
  ) THEN
    ALTER TABLE contas_a_pagar
      ADD CONSTRAINT contas_a_pagar_status_check
      CHECK (status_documento IN ('Nao emitido', 'Emitido pendente assinatura', 'Enviado financeiro'));
  END IF;
END $$;

DROP POLICY IF EXISTS "Users with contas a pagar module can read" ON contas_a_pagar;
DROP POLICY IF EXISTS "Users with contas a pagar module can manage their own data" ON contas_a_pagar;

CREATE POLICY "Users with contas a pagar module can read"
  ON contas_a_pagar
  FOR SELECT
  TO authenticated
  USING (has_module_access('contas_a_pagar'));

CREATE POLICY "Users with contas a pagar module can manage their own data"
  ON contas_a_pagar
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id AND has_module_access('contas_a_pagar'))
  WITH CHECK (auth.uid() = user_id AND has_module_access('contas_a_pagar'));

CREATE INDEX IF NOT EXISTS idx_contas_a_pagar_user_id ON contas_a_pagar(user_id);
CREATE INDEX IF NOT EXISTS idx_contas_a_pagar_created_at ON contas_a_pagar(created_at);

CREATE OR REPLACE FUNCTION set_modules_by_role()
RETURNS TRIGGER AS $$
BEGIN
  CASE NEW.role
    WHEN 'admin' THEN
      NEW.modules := ARRAY['usuarios', 'acessos', 'pessoal', 'teams', 'win_users', 'rateio_claro', 'rateio_google', 'contas_a_pagar'];
    WHEN 'financeiro' THEN
      NEW.modules := ARRAY['rateio_claro', 'rateio_google', 'contas_a_pagar'];
    WHEN 'usuario' THEN
      NEW.modules := ARRAY['acessos', 'pessoal', 'teams', 'win_users'];
    ELSE
      NEW.modules := ARRAY[]::text[];
  END CASE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

UPDATE users
SET modules = ARRAY['usuarios', 'acessos', 'pessoal', 'teams', 'win_users', 'rateio_claro', 'rateio_google', 'contas_a_pagar']
WHERE role = 'admin'
  AND NOT ('contas_a_pagar' = ANY(modules));

UPDATE users
SET modules = ARRAY['rateio_claro', 'rateio_google', 'contas_a_pagar']
WHERE role = 'financeiro'
  AND NOT ('contas_a_pagar' = ANY(modules));
