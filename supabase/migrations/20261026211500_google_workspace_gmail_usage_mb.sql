-- Add per-user Gmail usage volume (MB) from Google Admin Reports API
ALTER TABLE public.google_workspace_accounts
  ADD COLUMN IF NOT EXISTS gmail_usage_mb numeric;
