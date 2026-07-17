
-- Restrict bounty_submissions reads to protect submitter wallet exposure
DROP POLICY IF EXISTS bounty_submissions_public_read ON public.bounty_submissions;

CREATE POLICY bounty_submissions_participant_read
  ON public.bounty_submissions FOR SELECT
  TO authenticated
  USING (
    submitter_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.bounties b
      WHERE b.id = bounty_submissions.bounty_id AND b.creator_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
  );

-- Public view without the sensitive wallet column for listing submissions
CREATE OR REPLACE VIEW public.bounty_submissions_public
WITH (security_invoker = true) AS
SELECT id, bounty_id, submitter_id, proof_url, note, status, reviewed_at, created_at
FROM public.bounty_submissions;

GRANT SELECT ON public.bounty_submissions_public TO anon, authenticated;
