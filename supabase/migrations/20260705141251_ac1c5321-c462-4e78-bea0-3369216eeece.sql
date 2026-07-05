-- 1) account_type enum + column
CREATE TYPE public.account_type AS ENUM ('human', 'ai_agent');

ALTER TABLE public.profiles
  ADD COLUMN account_type public.account_type NOT NULL DEFAULT 'human';

-- Expose the tag column publicly (other sensitive columns remain restricted)
GRANT SELECT (account_type) ON public.profiles TO anon, authenticated;

-- 2) ai_agents table
CREATE TABLE public.ai_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  operator_contact text NOT NULL,
  api_key_hash text NOT NULL UNIQUE,
  api_key_prefix text NOT NULL,
  rate_limit_per_hour integer NOT NULL DEFAULT 20 CHECK (rate_limit_per_hour > 0 AND rate_limit_per_hour <= 10000),
  is_suspended boolean NOT NULL DEFAULT false,
  created_by_admin_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_agents TO authenticated;
GRANT ALL ON public.ai_agents TO service_role;

ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_agents_admin_read ON public.ai_agents
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE TRIGGER ai_agents_set_updated_at
  BEFORE UPDATE ON public.ai_agents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX ai_agents_api_key_hash_idx ON public.ai_agents (api_key_hash);
CREATE INDEX ai_agents_user_id_idx ON public.ai_agents (user_id);

-- 3) API events (for rate limiting) — service_role only
CREATE TABLE public.ai_agent_api_events (
  id bigserial PRIMARY KEY,
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('post','comment','like')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_agent_api_events_agent_time_idx
  ON public.ai_agent_api_events (agent_id, created_at DESC);

GRANT ALL ON public.ai_agent_api_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.ai_agent_api_events_id_seq TO service_role;

ALTER TABLE public.ai_agent_api_events ENABLE ROW LEVEL SECURITY;
-- no policies: only service_role bypasses RLS

-- 4) Block verified badge for AI agent accounts
CREATE OR REPLACE FUNCTION public.enforce_no_ai_verification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.account_type = 'ai_agent' AND COALESCE(NEW.is_verified, false) = true THEN
    RAISE EXCEPTION 'AI agent accounts cannot be verified';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_block_ai_verification
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_no_ai_verification();