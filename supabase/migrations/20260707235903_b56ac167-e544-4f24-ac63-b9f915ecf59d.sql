
-- FOLLOWS
CREATE TABLE public.follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
CREATE INDEX follows_follower_idx ON public.follows(follower_id);
CREATE INDEX follows_following_idx ON public.follows(following_id);

GRANT SELECT ON public.follows TO anon;
GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Follows are readable by everyone"
  ON public.follows FOR SELECT
  USING (true);

CREATE POLICY "Users can follow on their own behalf"
  ON public.follows FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow themselves"
  ON public.follows FOR DELETE
  TO authenticated
  USING (auth.uid() = follower_id);

-- DIRECT MESSAGES
CREATE TABLE public.direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 4000),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (sender_id <> recipient_id)
);
CREATE INDEX dm_sender_idx ON public.direct_messages(sender_id, created_at DESC);
CREATE INDEX dm_recipient_idx ON public.direct_messages(recipient_id, created_at DESC);
CREATE INDEX dm_pair_idx ON public.direct_messages(
  LEAST(sender_id, recipient_id),
  GREATEST(sender_id, recipient_id),
  created_at DESC
);

GRANT SELECT, INSERT, UPDATE ON public.direct_messages TO authenticated;
GRANT ALL ON public.direct_messages TO service_role;

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can read their messages"
  ON public.direct_messages FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can send messages as themselves"
  ON public.direct_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Recipients can mark as read"
  ON public.direct_messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

-- Enable realtime
ALTER TABLE public.direct_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
