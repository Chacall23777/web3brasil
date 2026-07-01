
CREATE TABLE public.ticker_config (
  id integer PRIMARY KEY DEFAULT 1,
  speed_seconds integer NOT NULL DEFAULT 20 CHECK (speed_seconds BETWEEN 5 AND 300),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ticker_config_singleton CHECK (id = 1)
);
GRANT SELECT ON public.ticker_config TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.ticker_config TO authenticated;
GRANT ALL ON public.ticker_config TO service_role;
ALTER TABLE public.ticker_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ticker_config read all" ON public.ticker_config FOR SELECT USING (true);
CREATE POLICY "ticker_config admin write" ON public.ticker_config FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.ticker_config (id, speed_seconds) VALUES (1, 15) ON CONFLICT DO NOTHING;

CREATE TABLE public.ticker_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_address text NOT NULL,
  chain text NOT NULL DEFAULT 'solana',
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ticker_tokens_contract_lower_idx ON public.ticker_tokens (lower(contract_address));
GRANT SELECT ON public.ticker_tokens TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.ticker_tokens TO authenticated;
GRANT ALL ON public.ticker_tokens TO service_role;
ALTER TABLE public.ticker_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ticker_tokens read all" ON public.ticker_tokens FOR SELECT USING (true);
CREATE POLICY "ticker_tokens admin write" ON public.ticker_tokens FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.ticker_tokens (contract_address, chain, ordem)
VALUES ('GkDYHiWxdkWXEJ3nGVyhFqQtYTqp4ggfQKqWpWpLpump', 'solana', 0)
ON CONFLICT DO NOTHING;
