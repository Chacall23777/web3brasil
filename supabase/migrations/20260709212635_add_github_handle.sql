-- Add GitHub handle to profiles, mirroring the existing x_handle / telegram_handle / instagram_handle pattern.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS github_handle text;

-- GRANT SELECT with a column list is additive on top of existing column grants
-- (it does not replace the earlier grant of x_handle/telegram_handle/instagram_handle/etc).
GRANT SELECT (github_handle) ON public.profiles TO anon, authenticated;
