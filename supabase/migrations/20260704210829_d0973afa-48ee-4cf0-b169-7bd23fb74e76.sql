
-- Extend profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS solana_wallet TEXT,
  ADD COLUMN IF NOT EXISTS telegram_handle TEXT,
  ADD COLUMN IF NOT EXISTS x_handle TEXT,
  ADD COLUMN IF NOT EXISTS instagram_handle TEXT,
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_method TEXT,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by_admin_id UUID,
  ADD COLUMN IF NOT EXISTS verified_tx_signature TEXT;

-- Backfill telegram_handle from legacy telegram
UPDATE public.profiles
  SET telegram_handle = telegram
  WHERE telegram_handle IS NULL AND telegram IS NOT NULL;

-- Unique burn signature (prevent reuse)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_verified_tx_signature_key
  ON public.profiles (verified_tx_signature)
  WHERE verified_tx_signature IS NOT NULL;

-- Restrict who can flip is_verified via RLS (users can't set these themselves)
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

CREATE POLICY "profiles_update_own_safe_fields"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND is_verified = (SELECT p.is_verified FROM public.profiles p WHERE p.id = auth.uid())
    AND verified_method IS NOT DISTINCT FROM (SELECT p.verified_method FROM public.profiles p WHERE p.id = auth.uid())
    AND verified_at IS NOT DISTINCT FROM (SELECT p.verified_at FROM public.profiles p WHERE p.id = auth.uid())
    AND verified_by_admin_id IS NOT DISTINCT FROM (SELECT p.verified_by_admin_id FROM public.profiles p WHERE p.id = auth.uid())
    AND verified_tx_signature IS NOT DISTINCT FROM (SELECT p.verified_tx_signature FROM public.profiles p WHERE p.id = auth.uid())
  );

-- has_role helper
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Admin audit trail
CREATE TABLE IF NOT EXISTS public.admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  target_user_id UUID,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_actions TO authenticated;
GRANT ALL ON public.admin_actions TO service_role;

ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read admin_actions"
  ON public.admin_actions
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
