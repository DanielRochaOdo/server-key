/*
  # Google Workspace catalog (Rateio Email)

  - Fonte da verdade: Google Workspace Directory API (Admin SDK)
  - Tabelas:
    - public.google_workspace_accounts
    - public.google_workspace_sync_state

  RLS:
  - SELECT: usuários autenticados com acesso ao módulo rateio_google
  - INSERT/UPDATE/DELETE: apenas service_role (Edge Function)
*/

-- ===== Catalog table =====

CREATE TABLE IF NOT EXISTS public.google_workspace_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_email text NOT NULL,
  domain text NOT NULL,
  full_name text,
  given_name text,
  family_name text,
  org_unit_path text,
  suspended boolean NOT NULL DEFAULT false,
  archived boolean NOT NULL DEFAULT false,
  deleted boolean NOT NULL DEFAULT false,
  last_login_at timestamptz,
  is_admin boolean,
  aliases text[],
  google_etag text,
  google_id text,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Constraints / indexes
CREATE UNIQUE INDEX IF NOT EXISTS google_workspace_accounts_primary_email_key
  ON public.google_workspace_accounts (primary_email);

CREATE UNIQUE INDEX IF NOT EXISTS google_workspace_accounts_google_id_key
  ON public.google_workspace_accounts (google_id)
  WHERE google_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_google_workspace_accounts_domain
  ON public.google_workspace_accounts (domain);

CREATE INDEX IF NOT EXISTS idx_google_workspace_accounts_suspended_deleted
  ON public.google_workspace_accounts (suspended, deleted);

ALTER TABLE public.google_workspace_accounts ENABLE ROW LEVEL SECURITY;

-- updated_at trigger if helper exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    DROP TRIGGER IF EXISTS update_google_workspace_accounts_updated_at ON public.google_workspace_accounts;
    CREATE TRIGGER update_google_workspace_accounts_updated_at
      BEFORE UPDATE ON public.google_workspace_accounts
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- RLS policies
DROP POLICY IF EXISTS google_workspace_accounts_read ON public.google_workspace_accounts;
CREATE POLICY google_workspace_accounts_read
  ON public.google_workspace_accounts
  FOR SELECT
  TO authenticated
  USING (has_module_access('rateio_google'));

DROP POLICY IF EXISTS google_workspace_accounts_write_service_role ON public.google_workspace_accounts;
CREATE POLICY google_workspace_accounts_write_service_role
  ON public.google_workspace_accounts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ===== Sync state =====

CREATE TABLE IF NOT EXISTS public.google_workspace_sync_state (
  domain text PRIMARY KEY,
  next_page_token text,
  last_full_sync_at timestamptz,
  last_incremental_sync_at timestamptz,
  last_sync_status text,
  last_sync_error text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.google_workspace_sync_state ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    DROP TRIGGER IF EXISTS update_google_workspace_sync_state_updated_at ON public.google_workspace_sync_state;
    CREATE TRIGGER update_google_workspace_sync_state_updated_at
      BEFORE UPDATE ON public.google_workspace_sync_state
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DROP POLICY IF EXISTS google_workspace_sync_state_read ON public.google_workspace_sync_state;
CREATE POLICY google_workspace_sync_state_read
  ON public.google_workspace_sync_state
  FOR SELECT
  TO authenticated
  USING (has_module_access('rateio_google'));

DROP POLICY IF EXISTS google_workspace_sync_state_write_service_role ON public.google_workspace_sync_state;
CREATE POLICY google_workspace_sync_state_write_service_role
  ON public.google_workspace_sync_state
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

