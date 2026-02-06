-- ================================
-- Rateio Claro Sync
-- ================================

-- Add status column for soft inactivation
ALTER TABLE public.rateio_claro
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Ensure status only allows expected values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rateio_claro_status_check'
  ) THEN
    ALTER TABLE public.rateio_claro
      ADD CONSTRAINT rateio_claro_status_check
      CHECK (status IN ('active', 'inactive'));
  END IF;
END $$;

-- Normalize existing rows (if any)
UPDATE public.rateio_claro
SET status = 'active'
WHERE status IS NULL;

-- Unique key for numero_linha (logical primary key)
CREATE UNIQUE INDEX IF NOT EXISTS rateio_claro_numero_linha_unique
  ON public.rateio_claro (numero_linha)
  WHERE numero_linha IS NOT NULL;

-- Sync logs for audit
CREATE TABLE IF NOT EXISTS public.rateio_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  inserted integer NOT NULL DEFAULT 0,
  updated integer NOT NULL DEFAULT 0,
  inactivated integer NOT NULL DEFAULT 0,
  options jsonb,
  checksum_planilha text,
  payload jsonb
);

ALTER TABLE public.rateio_sync_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rateio_sync_logs_read" ON public.rateio_sync_logs;
CREATE POLICY "rateio_sync_logs_read"
  ON public.rateio_sync_logs
  FOR SELECT
  TO authenticated
  USING (has_module_access('rateio_claro') OR is_admin());

-- Apply sync changes in a single transaction
CREATE OR REPLACE FUNCTION public.rateio_claro_sync_apply(
  p_inserts jsonb,
  p_updates jsonb,
  p_inactivate jsonb
)
RETURNS TABLE (
  inserted integer,
  updated integer,
  inactivated integer
)
LANGUAGE plpgsql
AS $$
DECLARE
  inserted_count integer := 0;
  updated_count integer := 0;
  inactivated_count integer := 0;
BEGIN
  WITH ins AS (
    INSERT INTO public.rateio_claro (nome, numero_linha, user_id, status, created_at, updated_at)
    SELECT
      (row->>'nome')::text,
      (row->>'numero_linha')::text,
      (row->>'user_id')::uuid,
      COALESCE(row->>'status', 'active')::text,
      COALESCE((row->>'created_at')::timestamptz, now()),
      COALESCE((row->>'updated_at')::timestamptz, now())
    FROM jsonb_array_elements(COALESCE(p_inserts, '[]'::jsonb)) AS row
    RETURNING 1
  ),
  upd AS (
    UPDATE public.rateio_claro r
    SET
      nome = u.nome,
      status = u.status,
      updated_at = u.updated_at
    FROM jsonb_to_recordset(COALESCE(p_updates, '[]'::jsonb))
      AS u(id uuid, nome text, status text, updated_at timestamptz)
    WHERE r.id = u.id
    RETURNING 1
  ),
  ina AS (
    UPDATE public.rateio_claro r
    SET status = 'inactive',
        updated_at = now()
    FROM jsonb_to_recordset(COALESCE(p_inactivate, '[]'::jsonb))
      AS i(id uuid)
    WHERE r.id = i.id
    RETURNING 1
  )
  SELECT
    (SELECT count(*) FROM ins),
    (SELECT count(*) FROM upd),
    (SELECT count(*) FROM ina)
  INTO inserted_count, updated_count, inactivated_count;

  inserted := inserted_count;
  updated := updated_count;
  inactivated := inactivated_count;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rateio_claro_sync_apply(jsonb, jsonb, jsonb)
  TO authenticated, service_role;
