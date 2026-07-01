ALTER TABLE public.ticker_tokens
  ADD COLUMN IF NOT EXISTS fonte text NOT NULL DEFAULT 'dexscreener',
  ADD COLUMN IF NOT EXISTS symbol text;

ALTER TABLE public.ticker_tokens
  DROP CONSTRAINT IF EXISTS ticker_tokens_fonte_check;
ALTER TABLE public.ticker_tokens
  ADD CONSTRAINT ticker_tokens_fonte_check CHECK (fonte IN ('dexscreener','coingecko'));

INSERT INTO public.ticker_tokens (contract_address, chain, ordem, ativo, fonte, symbol) VALUES
  ('bitcoin',      'bitcoin',  -4, true, 'coingecko', 'BTC'),
  ('ethereum',     'ethereum', -3, true, 'coingecko', 'ETH'),
  ('solana',       'solana',   -2, true, 'coingecko', 'SOL'),
  ('binancecoin',  'bnb',      -1, true, 'coingecko', 'BNB')
ON CONFLICT (lower(contract_address)) DO NOTHING;