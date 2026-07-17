
DROP POLICY IF EXISTS "Anyone can view distributions" ON public.challenge_distributions;
REVOKE SELECT ON public.challenge_distributions FROM anon;

CREATE POLICY "Distributions visible to involved parties"
  ON public.challenge_distributions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.challenges c
      WHERE c.id = challenge_distributions.challenge_id
        AND c.creator_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.challenge_participants p
      WHERE p.id = challenge_distributions.participant_id
        AND p.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

DROP POLICY IF EXISTS "Anyone can view validations" ON public.challenge_validations;
REVOKE SELECT ON public.challenge_validations FROM anon;

CREATE POLICY "Validations visible to involved parties"
  ON public.challenge_validations
  FOR SELECT
  TO authenticated
  USING (
    voter_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.challenge_participants p
      WHERE p.id = challenge_validations.participant_id
        AND (
          p.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.challenges c
            WHERE c.id = p.challenge_id AND c.creator_id = auth.uid()
          )
        )
    )
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );
