
-- 1) Create private schema not exposed by the Data API
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated, anon, service_role;

-- 2) Recreate has_role in private schema
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, anon, service_role;

-- 3) Update policies to reference private.has_role
DROP POLICY IF EXISTS posts_owner_update ON public.posts;
CREATE POLICY posts_owner_update ON public.posts FOR UPDATE
USING ((user_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS posts_owner_delete ON public.posts;
CREATE POLICY posts_owner_delete ON public.posts FOR DELETE
USING ((user_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS comments_owner_delete ON public.comments;
CREATE POLICY comments_owner_delete ON public.comments FOR DELETE
USING ((user_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS team_admin_write ON public.team_members;
CREATE POLICY team_admin_write ON public.team_members FOR ALL
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS social_admin_write ON public.social_links;
CREATE POLICY social_admin_write ON public.social_links FOR ALL
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

-- 4) Drop the public has_role now that nothing references it
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);

-- 5) Remove auto-admin race from handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
