/*
  Acessos are shared inside the module: every user with read access can see the
  same records, and every user with edit access must be able to maintain them.
  The previous write policy also required the current user to be the record
  creator, which made shared records impossible to edit.
*/

DROP POLICY IF EXISTS "Users with acessos module can read" ON public.acessos;
DROP POLICY IF EXISTS "Users with acessos module can manage their own data" ON public.acessos;
DROP POLICY IF EXISTS "acessos_module_read" ON public.acessos;
DROP POLICY IF EXISTS "acessos_module_manage_own" ON public.acessos;
DROP POLICY IF EXISTS "acessos_module_manage" ON public.acessos;

CREATE POLICY "acessos_module_read"
  ON public.acessos
  FOR SELECT
  TO authenticated
  USING (has_module_access('acessos'));

CREATE POLICY "acessos_module_manage"
  ON public.acessos
  FOR ALL
  TO authenticated
  USING (has_module_edit_access('acessos'))
  WITH CHECK (has_module_edit_access('acessos'));
