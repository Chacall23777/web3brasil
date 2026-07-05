
-- 1) handle_new_user: only create the profile, never grant super_admin automatically
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1), 'Usuário'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- 2) post_cache_translation: only the post owner can cache translations for their post
CREATE OR REPLACE FUNCTION public.post_cache_translation(_post_id uuid, _lang text, _text text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _owner uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  IF _lang NOT IN ('pt','en') THEN
    RAISE EXCEPTION 'invalid language';
  END IF;
  IF _text IS NULL OR length(_text) > 20000 THEN
    RAISE EXCEPTION 'invalid text';
  END IF;

  SELECT user_id INTO _owner FROM public.posts WHERE id = _post_id;
  IF _owner IS NULL THEN
    RAISE EXCEPTION 'post not found';
  END IF;
  IF _owner <> auth.uid() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF _lang = 'pt' THEN
    UPDATE public.posts SET content_pt = _text WHERE id = _post_id AND content_pt IS NULL;
  ELSE
    UPDATE public.posts SET content_en = _text WHERE id = _post_id AND content_en IS NULL;
  END IF;
END;
$function$;

-- 3) Lock down EXECUTE on SECURITY DEFINER functions
-- handle_new_user is a trigger only — nobody should be able to call it directly
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- post_cache_translation is an RPC for signed-in users only
REVOKE ALL ON FUNCTION public.post_cache_translation(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_cache_translation(uuid, text, text) TO authenticated;

-- has_role is used inside RLS policies evaluated as the querying role;
-- authenticated must keep EXECUTE, but revoke from anon/public
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
