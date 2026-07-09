-- Revoke EXECUTE on all SECURITY DEFINER trigger functions from PUBLIC/anon/authenticated.
-- These are trigger-only functions; they must never be callable directly via the API.
REVOKE ALL ON FUNCTION public.follows_notify() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.posts_mention_notify() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reposts_notify() FROM PUBLIC, anon, authenticated;

-- get_own_profile is an RPC intended for authenticated users only.
REVOKE ALL ON FUNCTION public.get_own_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_own_profile() TO authenticated;

-- Reassert lockdown on previously hardened definer functions in case of drift.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.post_cache_translation(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_cache_translation(uuid, text, text) TO authenticated;