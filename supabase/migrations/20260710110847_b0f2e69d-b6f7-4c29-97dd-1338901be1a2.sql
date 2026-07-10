ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS github_handle text;
GRANT SELECT (github_handle) ON public.profiles TO anon, authenticated;