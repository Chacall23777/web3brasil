
CREATE TABLE public.reposts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  comment text CHECK (comment IS NULL OR length(comment) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, original_post_id)
);

GRANT SELECT ON public.reposts TO anon;
GRANT SELECT, INSERT, DELETE ON public.reposts TO authenticated;
GRANT ALL ON public.reposts TO service_role;

ALTER TABLE public.reposts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reposts_select_all" ON public.reposts FOR SELECT USING (true);
CREATE POLICY "reposts_insert_own" ON public.reposts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reposts_delete_own" ON public.reposts FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX reposts_original_post_id_idx ON public.reposts(original_post_id);
CREATE INDEX reposts_user_id_created_at_idx ON public.reposts(user_id, created_at DESC);

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS reposts_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.reposts_count_trg()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET reposts_count = reposts_count + 1 WHERE id = NEW.original_post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET reposts_count = GREATEST(reposts_count - 1, 0) WHERE id = OLD.original_post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END; $$;

CREATE TRIGGER reposts_count_after_ins AFTER INSERT ON public.reposts
  FOR EACH ROW EXECUTE FUNCTION public.reposts_count_trg();
CREATE TRIGGER reposts_count_after_del AFTER DELETE ON public.reposts
  FOR EACH ROW EXECUTE FUNCTION public.reposts_count_trg();

CREATE OR REPLACE FUNCTION public.reposts_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _owner uuid;
BEGIN
  SELECT user_id INTO _owner FROM public.posts WHERE id = NEW.original_post_id;
  IF _owner IS NOT NULL AND _owner <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, actor_id, type, post_id)
    VALUES (_owner, NEW.user_id, 'repost', NEW.original_post_id);
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER reposts_notify_after_ins AFTER INSERT ON public.reposts
  FOR EACH ROW EXECUTE FUNCTION public.reposts_notify();

-- Backfill count
UPDATE public.posts p SET reposts_count = COALESCE((SELECT count(*) FROM public.reposts r WHERE r.original_post_id = p.id), 0);

-- Realtime
ALTER TABLE public.reposts REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reposts;
