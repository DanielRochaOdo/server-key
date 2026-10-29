CREATE TABLE IF NOT EXISTS contas_a_pagar_competencias (
  conta_id uuid PRIMARY KEY REFERENCES contas_a_pagar(id) ON DELETE CASCADE,
  competencia date NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contas_a_pagar_competencias_primeiro_dia_check
    CHECK (EXTRACT(DAY FROM competencia) = 1)
);

ALTER TABLE contas_a_pagar_competencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users with contas a pagar module can read competencies" ON contas_a_pagar_competencias;
DROP POLICY IF EXISTS "Users with contas a pagar module can manage competencies" ON contas_a_pagar_competencias;

CREATE POLICY "Users with contas a pagar module can read competencies"
  ON contas_a_pagar_competencias
  FOR SELECT
  TO authenticated
  USING (has_module_access('contas_a_pagar'));

CREATE POLICY "Users with contas a pagar module can manage competencies"
  ON contas_a_pagar_competencias
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id AND has_module_access('contas_a_pagar'))
  WITH CHECK (auth.uid() = user_id AND has_module_access('contas_a_pagar'));

CREATE INDEX IF NOT EXISTS idx_contas_a_pagar_competencias_user_id
  ON contas_a_pagar_competencias(user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_contas_a_pagar_competencias_updated_at'
  ) THEN
    CREATE TRIGGER update_contas_a_pagar_competencias_updated_at
      BEFORE UPDATE ON contas_a_pagar_competencias
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
