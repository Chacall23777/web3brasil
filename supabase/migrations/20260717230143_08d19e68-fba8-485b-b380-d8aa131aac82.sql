
-- CHALLENGES
CREATE TABLE public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  cover_url text,
  token_mint text NOT NULL,
  token_symbol text,
  token_name text,
  token_decimals int NOT NULL,
  total_amount numeric NOT NULL CHECK (total_amount > 0),
  winners_count int NOT NULL CHECK (winners_count > 0 AND winners_count <= 10000),
  amount_per_winner numeric NOT NULL,
  rules_template text NOT NULL DEFAULT 'custom',
  rules_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation_mode text NOT NULL DEFAULT 'manual' CHECK (validation_mode IN ('manual','community')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  escrow_wallet text NOT NULL,
  deposit_tx text,
  deposit_verified_at timestamptz,
  status text NOT NULL DEFAULT 'awaiting_deposit'
    CHECK (status IN ('draft','awaiting_deposit','active','closed','distributing','completed','failed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

GRANT SELECT ON public.challenges TO anon;
GRANT SELECT, INSERT, UPDATE ON public.challenges TO authenticated;
GRANT ALL ON public.challenges TO service_role;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view non-draft challenges"
  ON public.challenges FOR SELECT
  USING (status <> 'draft');
CREATE POLICY "Creators can view own challenges"
  ON public.challenges FOR SELECT TO authenticated
  USING (creator_id = auth.uid());
CREATE POLICY "Authenticated can create challenges"
  ON public.challenges FOR INSERT TO authenticated
  WITH CHECK (creator_id = auth.uid());
CREATE POLICY "Creator or admin can update challenge"
  ON public.challenges FOR UPDATE TO authenticated
  USING (creator_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (creator_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- amount_per_winner + updated_at trigger
CREATE OR REPLACE FUNCTION public.challenges_before_write()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.amount_per_winner := NEW.total_amount / NEW.winners_count;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_challenges_before_write
  BEFORE INSERT OR UPDATE ON public.challenges
  FOR EACH ROW EXECUTE FUNCTION public.challenges_before_write();

CREATE INDEX challenges_status_ends_idx ON public.challenges (status, ends_at);
CREATE INDEX challenges_creator_idx ON public.challenges (creator_id);

-- PARTICIPANTS
CREATE TABLE public.challenge_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet text NOT NULL,
  proof_url text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','valid','invalid')),
  validated_by uuid REFERENCES auth.users(id),
  validated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id)
);

GRANT SELECT, INSERT ON public.challenge_participants TO authenticated;
GRANT UPDATE ON public.challenge_participants TO authenticated;
GRANT ALL ON public.challenge_participants TO service_role;
ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner or creator or admin can read participants"
  ON public.challenge_participants FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.challenges c WHERE c.id = challenge_id AND c.creator_id = auth.uid())
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'super_admin')
  );
CREATE POLICY "Users can submit own participation"
  ON public.challenge_participants FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Creator or admin can update participation"
  ON public.challenge_participants FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.challenges c WHERE c.id = challenge_id AND c.creator_id = auth.uid())
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'super_admin')
  );

-- Public safe view (no wallet, no proof_url) for aggregated counts / avatars
CREATE VIEW public.challenge_participants_public AS
  SELECT id, challenge_id, user_id, status, created_at
  FROM public.challenge_participants;
GRANT SELECT ON public.challenge_participants_public TO anon, authenticated;

CREATE INDEX challenge_participants_challenge_idx ON public.challenge_participants (challenge_id, status);

-- VALIDATIONS (community votes)
CREATE TABLE public.challenge_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES public.challenge_participants(id) ON DELETE CASCADE,
  voter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (participant_id, voter_id)
);

GRANT SELECT ON public.challenge_validations TO anon;
GRANT SELECT, INSERT, DELETE ON public.challenge_validations TO authenticated;
GRANT ALL ON public.challenge_validations TO service_role;
ALTER TABLE public.challenge_validations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view validations"
  ON public.challenge_validations FOR SELECT USING (true);
CREATE POLICY "Users can cast own vote"
  ON public.challenge_validations FOR INSERT TO authenticated
  WITH CHECK (voter_id = auth.uid());
CREATE POLICY "Users can remove own vote"
  ON public.challenge_validations FOR DELETE TO authenticated
  USING (voter_id = auth.uid());

-- DISTRIBUTIONS
CREATE TABLE public.challenge_distributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  participant_id uuid REFERENCES public.challenge_participants(id) ON DELETE SET NULL,
  wallet text NOT NULL,
  amount numeric NOT NULL,
  tx_signature text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','success','failed')),
  error text,
  attempted_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.challenge_distributions TO anon, authenticated;
GRANT ALL ON public.challenge_distributions TO service_role;
ALTER TABLE public.challenge_distributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view distributions"
  ON public.challenge_distributions FOR SELECT USING (true);

CREATE INDEX challenge_distributions_challenge_idx ON public.challenge_distributions (challenge_id, status);

-- ESCROW KEYS (backend only)
CREATE TABLE public.challenge_escrow_keys (
  challenge_id uuid PRIMARY KEY REFERENCES public.challenges(id) ON DELETE CASCADE,
  secret_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.challenge_escrow_keys TO service_role;
ALTER TABLE public.challenge_escrow_keys ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role bypasses RLS.
