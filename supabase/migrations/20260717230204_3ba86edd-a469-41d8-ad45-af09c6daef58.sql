
DROP VIEW IF EXISTS public.challenge_participants_public;
CREATE VIEW public.challenge_participants_public
  WITH (security_invoker = true) AS
  SELECT id, challenge_id, user_id, status, created_at
  FROM public.challenge_participants;
GRANT SELECT ON public.challenge_participants_public TO anon, authenticated;
