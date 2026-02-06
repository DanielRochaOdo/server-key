-- ================================
-- Rateio Fatura MKM
-- ================================

-- Centros de custo
CREATE TABLE IF NOT EXISTS public.centros_custo_mkm (
  id smallint PRIMARY KEY,
  nome text UNIQUE NOT NULL
);

INSERT INTO public.centros_custo_mkm (id, nome) VALUES
  (1, 'COMERCIAL'),
  (2, 'ADMINISTRATIVO'),
  (3, 'COBRANCA'),
  (4, 'CALL CENTER (MARCACAO)')
ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome;

-- Tabela principal
CREATE TABLE IF NOT EXISTS public.rateio_mkm (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competencia date NOT NULL,
  centro_custo smallint NOT NULL REFERENCES public.centros_custo_mkm(id),
  qtd_de_sms integer NOT NULL DEFAULT 0,
  custo_sms numeric(14,3) NOT NULL DEFAULT 0,
  obs text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unicidade por competencia + centro de custo
CREATE UNIQUE INDEX IF NOT EXISTS rateio_mkm_competencia_centro_key
  ON public.rateio_mkm (competencia, centro_custo);

-- Indice por competencia
CREATE INDEX IF NOT EXISTS idx_rateio_mkm_competencia
  ON public.rateio_mkm (competencia);

-- Updated_at trigger (se helper existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    DROP TRIGGER IF EXISTS update_rateio_mkm_updated_at ON public.rateio_mkm;
    CREATE TRIGGER update_rateio_mkm_updated_at
      BEFORE UPDATE ON public.rateio_mkm
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- RLS
ALTER TABLE public.centros_custo_mkm ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rateio_mkm ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "centros_custo_mkm_read" ON public.centros_custo_mkm;
CREATE POLICY "centros_custo_mkm_read"
  ON public.centros_custo_mkm
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "centros_custo_mkm_write_admin" ON public.centros_custo_mkm;
CREATE POLICY "centros_custo_mkm_write_admin"
  ON public.centros_custo_mkm
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "rateio_mkm_read" ON public.rateio_mkm;
CREATE POLICY "rateio_mkm_read"
  ON public.rateio_mkm
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "rateio_mkm_write_admin" ON public.rateio_mkm;
CREATE POLICY "rateio_mkm_write_admin"
  ON public.rateio_mkm
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- RPC para layout
CREATE OR REPLACE FUNCTION public.get_rateio_mkm_layout(p_competencia date)
RETURNS TABLE (
  "Centro de custo" text,
  "QTD SMS/WABA ENVIADOS a 0,045" bigint,
  "CUSTOS SMS 0,045/WABA(0,30 E 0,55)" numeric(14,3),
  "OBS" text
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.rateio_mkm WHERE competencia = p_competencia
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      c.id AS centro_id,
      c.nome AS centro_nome,
      COALESCE(r.qtd_de_sms, 0)::bigint AS qtd,
      COALESCE(r.custo_sms, 0)::numeric(14,3) AS custo,
      COALESCE(r.obs, '') AS obs
    FROM public.centros_custo_mkm c
    LEFT JOIN public.rateio_mkm r
      ON r.centro_custo = c.id
     AND r.competencia = p_competencia
  ),
  total AS (
    SELECT
      9999 AS centro_id,
      'TOTAL FATURA'::text AS centro_nome,
      SUM(qtd)::bigint AS qtd,
      SUM(custo)::numeric(14,3) AS custo,
      ''::text AS obs
    FROM base
  )
  SELECT
    centro_nome AS "Centro de custo",
    qtd AS "QTD SMS/WABA ENVIADOS a 0,045",
    custo AS "CUSTOS SMS 0,045/WABA(0,30 E 0,55)",
    obs AS "OBS"
  FROM (
    SELECT * FROM base
    UNION ALL
    SELECT * FROM total
  ) AS result
  ORDER BY centro_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_rateio_mkm_layout(date) TO authenticated, service_role;
