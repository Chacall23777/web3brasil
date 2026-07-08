
-- 1. Post engagement counters
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS likes_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comments_count integer NOT NULL DEFAULT 0;

UPDATE public.posts p SET
  likes_count = COALESCE((SELECT count(*)::int FROM public.likes l WHERE l.post_id = p.id), 0),
  comments_count = COALESCE((SELECT count(*)::int FROM public.comments c WHERE c.post_id = p.id), 0);

CREATE OR REPLACE FUNCTION public.likes_count_trg()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS likes_count_ai ON public.likes;
CREATE TRIGGER likes_count_ai
AFTER INSERT OR DELETE ON public.likes
FOR EACH ROW EXECUTE FUNCTION public.likes_count_trg();

CREATE OR REPLACE FUNCTION public.comments_count_trg()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS comments_count_ai ON public.comments;
CREATE TRIGGER comments_count_ai
AFTER INSERT OR DELETE ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.comments_count_trg();

-- 2. Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('follow','mention')),
  post_id uuid,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON public.notifications (user_id) WHERE read_at IS NULL;

GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own notifications read" ON public.notifications;
CREATE POLICY "own notifications read" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "own notifications update" ON public.notifications;
CREATE POLICY "own notifications update" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own notifications delete" ON public.notifications;
CREATE POLICY "own notifications delete" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 3. Follow -> notification
CREATE OR REPLACE FUNCTION public.follows_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.follower_id <> NEW.following_id THEN
    INSERT INTO public.notifications (user_id, actor_id, type)
    VALUES (NEW.following_id, NEW.follower_id, 'follow');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS follows_notify_ai ON public.follows;
CREATE TRIGGER follows_notify_ai
AFTER INSERT ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.follows_notify();

-- 4. Mentions in post content -> notifications
CREATE OR REPLACE FUNCTION public.posts_mention_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m text;
  mentioned uuid;
BEGIN
  IF NEW.content IS NULL THEN RETURN NEW; END IF;
  FOR m IN
    SELECT DISTINCT (regexp_matches(NEW.content, '@([A-Za-z0-9_.-]{2,32})', 'g'))[1]
  LOOP
    SELECT id INTO mentioned FROM public.profiles WHERE lower(display_name) = lower(m) LIMIT 1;
    IF mentioned IS NOT NULL AND mentioned <> NEW.user_id THEN
      INSERT INTO public.notifications (user_id, actor_id, type, post_id)
      VALUES (mentioned, NEW.user_id, 'mention', NEW.id);
    END IF;
  END LOOP;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS posts_mention_notify_ai ON public.posts;
CREATE TRIGGER posts_mention_notify_ai
AFTER INSERT ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.posts_mention_notify();

-- 5. Realtime for notifications
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
