
-- Restrict column-level SELECT on profiles.
-- Anyone (anon + signed-in) may only see safe display fields.
-- Sensitive fields become inaccessible via the Data API for everyone;
-- the owner reads them through get_own_profile(), and server code uses supabaseAdmin.

REVOKE SELECT ON public.profiles FROM anon, authenticated;

GRANT SELECT (
  id,
  display_name,
  avatar_url,
  bio,
  is_verified,
  x_handle,
  telegram_handle,
  instagram_handle,
  preferred_language,
  created_at,
  updated_at
) ON public.profiles TO anon, authenticated;

-- Keep INSERT / UPDATE / DELETE table-level grants intact; RLS still restricts them.
-- (These were granted in earlier migrations and are unaffected by REVOKE SELECT.)

-- Owner-only read of the full profile row (including sensitive fields).
CREATE OR REPLACE FUNCTION public.get_own_profile()
RETURNS public.profiles
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.profiles;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  SELECT * INTO p FROM public.profiles WHERE id = auth.uid();
  RETURN p;
END;
$$;

REVOKE ALL ON FUNCTION public.get_own_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_own_profile() TO authenticated;
