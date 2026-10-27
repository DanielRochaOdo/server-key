-- Allow authenticated profiles with the Rateio Google module to read the
-- synchronized Workspace catalog and its sync status.

BEGIN;

GRANT SELECT ON public.google_workspace_accounts TO authenticated;
GRANT SELECT ON public.google_workspace_sync_state TO authenticated;

DROP POLICY IF EXISTS google_workspace_accounts_read
  ON public.google_workspace_accounts;
CREATE POLICY google_workspace_accounts_read
  ON public.google_workspace_accounts
  FOR SELECT
  TO authenticated
  USING (has_module_access('rateio_google'));

DROP POLICY IF EXISTS google_workspace_sync_state_read
  ON public.google_workspace_sync_state;
CREATE POLICY google_workspace_sync_state_read
  ON public.google_workspace_sync_state
  FOR SELECT
  TO authenticated
  USING (has_module_access('rateio_google'));

NOTIFY pgrst, 'reload schema';

COMMIT;
