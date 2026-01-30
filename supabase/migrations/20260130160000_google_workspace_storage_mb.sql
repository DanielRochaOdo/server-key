-- Add storage usage (MB) from Google Reports API
ALTER TABLE public.google_workspace_accounts
  ADD COLUMN IF NOT EXISTS storage_mb numeric;

