DROP POLICY IF EXISTS "Users with contas a pagar module can manage their own data" ON public.contas_a_pagar;
DROP POLICY IF EXISTS "Users with contas a pagar module can update entries" ON public.contas_a_pagar;
DROP POLICY IF EXISTS "Users with contas a pagar module can delete entries" ON public.contas_a_pagar;

CREATE POLICY "Users with contas a pagar module can update entries"
  ON public.contas_a_pagar
  FOR UPDATE
  TO authenticated
  USING (has_module_access('contas_a_pagar'))
  WITH CHECK (has_module_access('contas_a_pagar'));

CREATE POLICY "Users with contas a pagar module can delete entries"
  ON public.contas_a_pagar
  FOR DELETE
  TO authenticated
  USING (has_module_access('contas_a_pagar'));