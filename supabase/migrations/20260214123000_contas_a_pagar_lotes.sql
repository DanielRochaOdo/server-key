/*
  # Contas a pagar - Lotes

  1. New Tables
    - contas_a_pagar_lotes
      - id (uuid, primary key)
      - nome (text)
      - origem (text: fixa/avulsa/misto)
      - fechado (boolean)
      - resumido (boolean)
      - detalhado (boolean)
      - total (integer)
      - fixas_total (integer)
      - avulsas_total (integer)
      - criado_em (timestamp)
      - updated_at (timestamp)
      - user_id (uuid)

    - contas_a_pagar_lote_itens
      - id (uuid, primary key)
      - lote_id (uuid)
      - tipo (text: resumido/detalhado)
      - conta_id (uuid)
      - tipo_conta (text: fixa/avulsa)
      - fornecedor (text)
      - valor (numeric)
      - vencimento (date)
      - pagamento (text)
      - empresa (text)
      - descricao (text)
      - nota_fiscal (text)
      - setor_responsavel (text)
      - banco (text)
      - agencia (text)
      - conta (text)
      - tipo_de_conta (text)
      - cpf_cnpj (text)
      - anexos (text)
      - user_id (uuid)
      - created_at (timestamp)
      - updated_at (timestamp)

  2. Security
    - Enable RLS
    - Policies for module access
*/

CREATE TABLE IF NOT EXISTS contas_a_pagar_lotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  origem text NOT NULL DEFAULT 'fixa',
  fechado boolean NOT NULL DEFAULT false,
  resumido boolean NOT NULL DEFAULT false,
  detalhado boolean NOT NULL DEFAULT false,
  total integer NOT NULL DEFAULT 0,
  fixas_total integer NOT NULL DEFAULT 0,
  avulsas_total integer NOT NULL DEFAULT 0,
  criado_em timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contas_a_pagar_lotes_origem_check'
  ) THEN
    ALTER TABLE contas_a_pagar_lotes
      ADD CONSTRAINT contas_a_pagar_lotes_origem_check
      CHECK (origem IN ('fixa', 'avulsa', 'misto'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS contas_a_pagar_lote_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id uuid NOT NULL REFERENCES contas_a_pagar_lotes(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  conta_id uuid REFERENCES contas_a_pagar(id) ON DELETE SET NULL,
  tipo_conta text,
  fornecedor text,
  valor numeric(12,2),
  vencimento date,
  pagamento text,
  empresa text,
  descricao text,
  nota_fiscal text,
  setor_responsavel text,
  banco text,
  agencia text,
  conta text,
  tipo_de_conta text,
  cpf_cnpj text,
  anexos text,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contas_a_pagar_lote_itens_tipo_check'
  ) THEN
    ALTER TABLE contas_a_pagar_lote_itens
      ADD CONSTRAINT contas_a_pagar_lote_itens_tipo_check
      CHECK (tipo IN ('resumido', 'detalhado'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contas_a_pagar_lote_itens_tipo_conta_check'
  ) THEN
    ALTER TABLE contas_a_pagar_lote_itens
      ADD CONSTRAINT contas_a_pagar_lote_itens_tipo_conta_check
      CHECK (tipo_conta IN ('fixa', 'avulsa') OR tipo_conta IS NULL);
  END IF;
END $$;

ALTER TABLE contas_a_pagar_lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas_a_pagar_lote_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users with contas a pagar module can read lotes" ON contas_a_pagar_lotes;
DROP POLICY IF EXISTS "Users with contas a pagar module can manage lotes" ON contas_a_pagar_lotes;
DROP POLICY IF EXISTS "Users with contas a pagar module can read lote itens" ON contas_a_pagar_lote_itens;
DROP POLICY IF EXISTS "Users with contas a pagar module can manage lote itens" ON contas_a_pagar_lote_itens;

CREATE POLICY "Users with contas a pagar module can read lotes"
  ON contas_a_pagar_lotes
  FOR SELECT
  TO authenticated
  USING (has_module_access('contas_a_pagar'));

CREATE POLICY "Users with contas a pagar module can manage lotes"
  ON contas_a_pagar_lotes
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id AND has_module_access('contas_a_pagar'))
  WITH CHECK (auth.uid() = user_id AND has_module_access('contas_a_pagar'));

CREATE POLICY "Users with contas a pagar module can read lote itens"
  ON contas_a_pagar_lote_itens
  FOR SELECT
  TO authenticated
  USING (has_module_access('contas_a_pagar'));

CREATE POLICY "Users with contas a pagar module can manage lote itens"
  ON contas_a_pagar_lote_itens
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id AND has_module_access('contas_a_pagar'))
  WITH CHECK (auth.uid() = user_id AND has_module_access('contas_a_pagar'));

CREATE INDEX IF NOT EXISTS idx_contas_a_pagar_lotes_user_id ON contas_a_pagar_lotes(user_id);
CREATE INDEX IF NOT EXISTS idx_contas_a_pagar_lotes_created_at ON contas_a_pagar_lotes(criado_em);
CREATE INDEX IF NOT EXISTS idx_contas_a_pagar_lote_itens_lote_id ON contas_a_pagar_lote_itens(lote_id);
CREATE INDEX IF NOT EXISTS idx_contas_a_pagar_lote_itens_conta_id ON contas_a_pagar_lote_itens(conta_id);
CREATE INDEX IF NOT EXISTS idx_contas_a_pagar_lote_itens_user_id ON contas_a_pagar_lote_itens(user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_contas_a_pagar_lotes_updated_at'
  ) THEN
    CREATE TRIGGER update_contas_a_pagar_lotes_updated_at
      BEFORE UPDATE ON contas_a_pagar_lotes
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_contas_a_pagar_lote_itens_updated_at'
  ) THEN
    CREATE TRIGGER update_contas_a_pagar_lote_itens_updated_at
      BEFORE UPDATE ON contas_a_pagar_lote_itens
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
