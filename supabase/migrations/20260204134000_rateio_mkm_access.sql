-- =============================================
-- Rateio MKM access control + role modules
-- =============================================

-- Update set_modules_by_role to include rateio_mkm
CREATE OR REPLACE FUNCTION set_modules_by_role()
RETURNS TRIGGER AS $$
BEGIN
  CASE NEW.role
    WHEN 'admin' THEN
      NEW.modules := ARRAY['usuarios', 'acessos', 'pessoal', 'teams', 'win_users', 'rateio_claro', 'rateio_google', 'contas_a_pagar', 'rateio_mkm'];
    WHEN 'financeiro' THEN
      NEW.modules := ARRAY['rateio_claro', 'rateio_google', 'rateio_mkm'];
    WHEN 'usuario' THEN
      NEW.modules := ARRAY['acessos', 'pessoal', 'teams', 'win_users'];
    ELSE
      NEW.modules := ARRAY[]::text[];
  END CASE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add rateio_mkm to existing admin/financeiro users (idempotent)
UPDATE public.users
SET modules = array_append(coalesce(modules, ARRAY[]::text[]), 'rateio_mkm')
WHERE role IN ('admin', 'financeiro')
  AND NOT (coalesce(modules, ARRAY[]::text[]) @> ARRAY['rateio_mkm']);

-- Tighten RLS for MKM tables
DROP POLICY IF EXISTS "centros_custo_mkm_read" ON public.centros_custo_mkm;
CREATE POLICY "centros_custo_mkm_read"
  ON public.centros_custo_mkm
  FOR SELECT
  TO authenticated
  USING (has_module_access('rateio_mkm') OR is_admin());

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
  USING (has_module_access('rateio_mkm') OR is_admin());

DROP POLICY IF EXISTS "rateio_mkm_write_admin" ON public.rateio_mkm;
CREATE POLICY "rateio_mkm_write_admin"
  ON public.rateio_mkm
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
