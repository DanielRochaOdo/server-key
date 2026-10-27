-- Module records are shared across the users who can access each module.
-- Keep writes behind edit_modules, but do not restrict them to the creator.
BEGIN;

-- Acessos
DROP POLICY IF EXISTS "acessos_module_manage_own" ON public.acessos;
DROP POLICY IF EXISTS "acessos_module_manage_shared" ON public.acessos;
CREATE POLICY "acessos_module_manage_shared"
  ON public.acessos
  FOR ALL
  TO authenticated
  USING (public.has_module_edit_access('acessos'))
  WITH CHECK (public.has_module_edit_access('acessos'));

-- Teams
DROP POLICY IF EXISTS "teams_users_manage_own" ON public.teams;
DROP POLICY IF EXISTS "teams_module_manage_shared" ON public.teams;
DROP POLICY IF EXISTS "teams_module_read" ON public.teams;
CREATE POLICY "teams_module_read"
  ON public.teams
  FOR SELECT
  TO authenticated
  USING (public.has_module_access('teams'));
CREATE POLICY "teams_module_manage_shared"
  ON public.teams
  FOR ALL
  TO authenticated
  USING (public.has_module_edit_access('teams'))
  WITH CHECK (public.has_module_edit_access('teams'));

-- Rateio Claro
DROP POLICY IF EXISTS "Users with module access can insert own rateio_claro" ON public.rateio_claro;
DROP POLICY IF EXISTS "Users with module access can update own rateio_claro" ON public.rateio_claro;
DROP POLICY IF EXISTS "Users with module access can delete own rateio_claro" ON public.rateio_claro;
DROP POLICY IF EXISTS "rateio_claro_module_manage_shared" ON public.rateio_claro;
CREATE POLICY "rateio_claro_module_manage_shared"
  ON public.rateio_claro
  FOR ALL
  TO authenticated
  USING (public.has_module_edit_access('rateio_claro'))
  WITH CHECK (public.has_module_edit_access('rateio_claro'));

-- Rateio Google
DROP POLICY IF EXISTS "rateio_google_module_manage_own" ON public.rateio_google;
DROP POLICY IF EXISTS "rateio_google_module_manage_shared" ON public.rateio_google;
CREATE POLICY "rateio_google_module_manage_shared"
  ON public.rateio_google
  FOR ALL
  TO authenticated
  USING (public.has_module_edit_access('rateio_google'))
  WITH CHECK (public.has_module_edit_access('rateio_google'));

-- Contas a Pagar and its shared batches
DROP POLICY IF EXISTS "Users with contas a pagar module can insert their own data" ON public.contas_a_pagar;
DROP POLICY IF EXISTS "Users with contas a pagar module can manage their own data" ON public.contas_a_pagar;
DROP POLICY IF EXISTS "contas_a_pagar_module_manage_shared" ON public.contas_a_pagar;
CREATE POLICY "contas_a_pagar_module_manage_shared"
  ON public.contas_a_pagar
  FOR ALL
  TO authenticated
  USING (public.has_module_edit_access('contas_a_pagar'))
  WITH CHECK (public.has_module_edit_access('contas_a_pagar'));

DROP POLICY IF EXISTS "Users with contas a pagar module can manage lotes" ON public.contas_a_pagar_lotes;
DROP POLICY IF EXISTS "contas_a_pagar_lotes_module_manage_shared" ON public.contas_a_pagar_lotes;
DROP POLICY IF EXISTS "contas_a_pagar_lotes_module_read_shared" ON public.contas_a_pagar_lotes;
CREATE POLICY "contas_a_pagar_lotes_module_read_shared"
  ON public.contas_a_pagar_lotes
  FOR SELECT
  TO authenticated
  USING (public.has_module_access('contas_a_pagar'));
CREATE POLICY "contas_a_pagar_lotes_module_manage_shared"
  ON public.contas_a_pagar_lotes
  FOR ALL
  TO authenticated
  USING (public.has_module_edit_access('contas_a_pagar'))
  WITH CHECK (public.has_module_edit_access('contas_a_pagar'));

DROP POLICY IF EXISTS "Users with contas a pagar module can manage lote itens" ON public.contas_a_pagar_lote_itens;
DROP POLICY IF EXISTS "contas_a_pagar_lote_itens_module_manage_shared" ON public.contas_a_pagar_lote_itens;
DROP POLICY IF EXISTS "contas_a_pagar_lote_itens_module_read_shared" ON public.contas_a_pagar_lote_itens;
CREATE POLICY "contas_a_pagar_lote_itens_module_read_shared"
  ON public.contas_a_pagar_lote_itens
  FOR SELECT
  TO authenticated
  USING (public.has_module_access('contas_a_pagar'));
CREATE POLICY "contas_a_pagar_lote_itens_module_manage_shared"
  ON public.contas_a_pagar_lote_itens
  FOR ALL
  TO authenticated
  USING (public.has_module_edit_access('contas_a_pagar'))
  WITH CHECK (public.has_module_edit_access('contas_a_pagar'));

-- Controle de Empresas
DROP POLICY IF EXISTS "controle_empresas_module_manage_own" ON public.controle_empresas;
DROP POLICY IF EXISTS "controle_empresas_module_manage_shared" ON public.controle_empresas;
CREATE POLICY "controle_empresas_module_manage_shared"
  ON public.controle_empresas
  FOR ALL
  TO authenticated
  USING (public.has_module_edit_access('controle_empresas'))
  WITH CHECK (public.has_module_edit_access('controle_empresas'));

NOTIFY pgrst, 'reload schema';
COMMIT;
