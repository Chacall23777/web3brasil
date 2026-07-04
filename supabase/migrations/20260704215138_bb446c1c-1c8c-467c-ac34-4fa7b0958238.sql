
-- 1. Posts: track edits
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.posts_mark_edited()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  IF OLD.title IS DISTINCT FROM NEW.title
     OR OLD.content IS DISTINCT FROM NEW.content
     OR OLD.image_url IS DISTINCT FROM NEW.image_url
     OR OLD.token_name IS DISTINCT FROM NEW.token_name
     OR OLD.token_symbol IS DISTINCT FROM NEW.token_symbol
     OR OLD.token_link IS DISTINCT FROM NEW.token_link THEN
    NEW.edited_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS posts_mark_edited_trg ON public.posts;
CREATE TRIGGER posts_mark_edited_trg
BEFORE UPDATE ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.posts_mark_edited();

-- 2. Update posts UPDATE/DELETE policies: only verified owners can edit; admin+super_admin bypass
DROP POLICY IF EXISTS posts_owner_update ON public.posts;
CREATE POLICY posts_owner_update ON public.posts
FOR UPDATE
USING (
  (user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_verified = true))
  OR private.has_role(auth.uid(), 'admin'::public.app_role)
  OR private.has_role(auth.uid(), 'super_admin'::public.app_role)
)
WITH CHECK (
  (user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_verified = true))
  OR private.has_role(auth.uid(), 'admin'::public.app_role)
  OR private.has_role(auth.uid(), 'super_admin'::public.app_role)
);

DROP POLICY IF EXISTS posts_owner_delete ON public.posts;
CREATE POLICY posts_owner_delete ON public.posts
FOR DELETE
USING (
  user_id = auth.uid()
  OR private.has_role(auth.uid(), 'admin'::public.app_role)
  OR private.has_role(auth.uid(), 'super_admin'::public.app_role)
);

-- 3. Seed initial super_admin (first user ever registered)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::public.app_role
FROM auth.users
ORDER BY created_at ASC
LIMIT 1
ON CONFLICT (user_id, role) DO NOTHING;

-- 4. handle_new_user: if there is no super_admin yet, grant it to the new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_super boolean;
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1), 'Usuário'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'super_admin'::public.app_role)
    INTO has_super;

  IF NOT has_super THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'super_admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
