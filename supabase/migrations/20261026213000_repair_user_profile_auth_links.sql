/*
  # Repair auth/profile links after historical replays

  Keeps public.users linked to auth.users by email and gives the authenticated
  user a safe way to repair only their own profile link.
*/

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'owner', 'financeiro', 'usuario'));

UPDATE public.users AS pu
SET auth_uid = au.id,
    updated_at = NOW()
FROM auth.users AS au
WHERE lower(pu.email) = lower(au.email)
  AND pu.auth_uid IS DISTINCT FROM au.id
  AND NOT EXISTS (
    SELECT 1
    FROM public.users AS other
    WHERE other.auth_uid = au.id
      AND other.id <> pu.id
  );

CREATE OR REPLACE FUNCTION public.repair_current_user_profile_link()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  current_uid uuid := auth.uid();
  current_email text;
BEGIN
  IF current_uid IS NULL THEN
    RETURN false;
  END IF;

  SELECT lower(email)
  INTO current_email
  FROM auth.users
  WHERE id = current_uid;

  IF current_email IS NULL OR current_email = '' THEN
    RETURN false;
  END IF;

  UPDATE public.users AS pu
  SET auth_uid = current_uid,
      updated_at = NOW()
  WHERE lower(pu.email) = current_email
    AND NOT EXISTS (
      SELECT 1
      FROM public.users AS other
      WHERE other.auth_uid = current_uid
        AND other.id <> pu.id
    );

  RETURN EXISTS (
    SELECT 1
    FROM public.users
    WHERE auth_uid = current_uid
      AND lower(email) = current_email
  );
END;
$$;

REVOKE ALL ON FUNCTION public.repair_current_user_profile_link() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.repair_current_user_profile_link() TO authenticated, service_role;

DROP POLICY IF EXISTS users_self_read_profile ON public.users;
CREATE POLICY users_self_read_profile
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth_uid = auth.uid());
