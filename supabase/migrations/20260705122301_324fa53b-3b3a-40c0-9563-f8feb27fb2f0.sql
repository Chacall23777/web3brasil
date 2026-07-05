
-- profiles.preferred_language
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_language TEXT NOT NULL DEFAULT 'pt'
    CHECK (preferred_language IN ('pt','en'));

-- posts translation columns
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS content_original TEXT,
  ADD COLUMN IF NOT EXISTS content_pt TEXT,
  ADD COLUMN IF NOT EXISTS content_en TEXT,
  ADD COLUMN IF NOT EXISTS original_language TEXT NOT NULL DEFAULT 'pt'
    CHECK (original_language IN ('pt','en'));

-- backfill existing rows
UPDATE public.posts
SET content_original = COALESCE(content_original, content),
    content_pt = COALESCE(content_pt, CASE WHEN original_language = 'pt' THEN content END),
    content_en = COALESCE(content_en, CASE WHEN original_language = 'en' THEN content END)
WHERE content_original IS NULL OR content_pt IS NULL OR content_en IS NULL;

-- security definer function: any authenticated user can cache a translation for a post
CREATE OR REPLACE FUNCTION public.post_cache_translation(
  _post_id UUID,
  _lang TEXT,
  _text TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  IF _lang NOT IN ('pt','en') THEN
    RAISE EXCEPTION 'invalid language';
  END IF;
  IF _lang = 'pt' THEN
    UPDATE public.posts SET content_pt = _text WHERE id = _post_id AND content_pt IS NULL;
  ELSE
    UPDATE public.posts SET content_en = _text WHERE id = _post_id AND content_en IS NULL;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.post_cache_translation(UUID, TEXT, TEXT) TO authenticated;
