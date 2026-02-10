-- Add visitas clinicas module

CREATE TABLE IF NOT EXISTS public.visitas_clinicas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL,
  servico text NOT NULL,
  clinica text NOT NULL,
  pessoa1 text,
  pessoa2 text,
  pessoa3 text,
  status text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.visitas_clinicas ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'visitas_clinicas_status_check'
  ) THEN
    ALTER TABLE public.visitas_clinicas
      ADD CONSTRAINT visitas_clinicas_status_check
      CHECK (status IN ('concluido', 'pendente', 'atrasado'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'visitas_clinicas_clinica_check'
  ) THEN
    ALTER TABLE public.visitas_clinicas
      ADD CONSTRAINT visitas_clinicas_clinica_check
      CHECK (clinica IN ('Parangaba', 'Bezerra', 'Aguanambi'));
  END IF;
END $$;

DROP POLICY IF EXISTS "visitas_clinicas_read" ON public.visitas_clinicas;
DROP POLICY IF EXISTS "visitas_clinicas_manage" ON public.visitas_clinicas;

CREATE POLICY "visitas_clinicas_read"
  ON public.visitas_clinicas
  FOR SELECT
  TO authenticated
  USING (has_module_access('visitas_clinicas'));

CREATE POLICY "visitas_clinicas_manage"
  ON public.visitas_clinicas
  FOR ALL
  TO authenticated
  USING (has_module_access('visitas_clinicas'))
  WITH CHECK (has_module_access('visitas_clinicas'));

CREATE INDEX IF NOT EXISTS idx_visitas_clinicas_data ON public.visitas_clinicas(data);
CREATE INDEX IF NOT EXISTS idx_visitas_clinicas_status ON public.visitas_clinicas(status);

UPDATE public.users
SET modules = array_append(coalesce(modules, ARRAY[]::text[]), 'visitas_clinicas')
WHERE role IN ('admin', 'financeiro', 'owner')
  AND NOT (coalesce(modules, ARRAY[]::text[]) @> ARRAY['visitas_clinicas']);
