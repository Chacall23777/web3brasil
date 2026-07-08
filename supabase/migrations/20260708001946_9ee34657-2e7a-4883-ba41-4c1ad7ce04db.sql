
REVOKE EXECUTE ON FUNCTION public.follows_notify() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.posts_mention_notify() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.likes_count_trg() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.comments_count_trg() FROM PUBLIC, anon, authenticated;
