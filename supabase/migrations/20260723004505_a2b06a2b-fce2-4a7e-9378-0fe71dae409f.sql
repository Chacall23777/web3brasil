
CREATE TABLE public.kv_store (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.kv_store TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kv_store TO authenticated;
GRANT ALL ON public.kv_store TO service_role;

ALTER TABLE public.kv_store ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kv_store public read"
  ON public.kv_store FOR SELECT
  USING (true);

CREATE POLICY "kv_store owner insert"
  ON public.kv_store FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "kv_store owner update"
  ON public.kv_store FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "kv_store owner delete"
  ON public.kv_store FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

CREATE TRIGGER kv_store_set_updated_at
  BEFORE UPDATE ON public.kv_store
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX kv_store_owner_id_idx ON public.kv_store(owner_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.kv_store;
ALTER TABLE public.kv_store REPLICA IDENTITY FULL;
