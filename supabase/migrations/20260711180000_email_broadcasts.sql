-- Histórico de e-mails em massa disparados por admins
CREATE TABLE IF NOT EXISTS public.email_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  post_id UUID,
  recipients_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.email_broadcasts TO authenticated;
GRANT ALL ON public.email_broadcasts TO service_role;

ALTER TABLE public.email_broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read email_broadcasts"
  ON public.email_broadcasts
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
