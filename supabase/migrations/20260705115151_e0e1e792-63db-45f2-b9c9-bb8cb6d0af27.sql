
CREATE TABLE public.advertisements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text NOT NULL,
  title text,
  tg_link text,
  x_link text,
  website_link text,
  duration_days integer NOT NULL CHECK (duration_days IN (7, 15, 30)),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_by_admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.advertisements TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.advertisements TO authenticated;
GRANT ALL ON public.advertisements TO service_role;

ALTER TABLE public.advertisements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view ads"
  ON public.advertisements FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert ads"
  ON public.advertisements FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

CREATE POLICY "Admins can update ads"
  ON public.advertisements FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

CREATE POLICY "Admins can delete ads"
  ON public.advertisements FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

CREATE OR REPLACE FUNCTION public.ads_set_expires_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.duration_days IS DISTINCT FROM OLD.duration_days THEN
    NEW.expires_at := COALESCE(NEW.created_at, now()) + (NEW.duration_days || ' days')::interval;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER ads_set_expires_at_trg
  BEFORE INSERT OR UPDATE ON public.advertisements
  FOR EACH ROW EXECUTE FUNCTION public.ads_set_expires_at();

CREATE INDEX idx_ads_active_expires ON public.advertisements (is_active, expires_at);
