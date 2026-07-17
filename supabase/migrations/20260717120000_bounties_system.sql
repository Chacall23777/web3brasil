-- ============================================================
-- Sistema de bounties (Fase 1): recompensa paga em qualquer token
-- SPL da Solana, com custódia via carteira gerada por bounty
-- (controlada pelo backend, nunca exposta ao cliente).
-- ============================================================

create table if not exists public.bounties (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 140),
  description text not null check (char_length(description) between 10 and 4000),
  token_mint text not null,
  token_symbol text,
  token_name text,
  token_decimals int not null default 0,
  reward_amount numeric not null check (reward_amount > 0),
  vault_address text not null unique,
  status text not null default 'awaiting_deposit'
    check (status in ('awaiting_deposit', 'open', 'under_review', 'completed', 'refunded', 'cancelled')),
  deposit_tx_signature text,
  deadline timestamptz,
  stream_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bounties_status_idx on public.bounties(status);
create index if not exists bounties_creator_idx on public.bounties(creator_id);

create table if not exists public.bounty_submissions (
  id uuid primary key default gen_random_uuid(),
  bounty_id uuid not null references public.bounties(id) on delete cascade,
  submitter_id uuid not null references public.profiles(id) on delete cascade,
  submitter_wallet text not null,
  proof_url text not null,
  note text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  payout_tx_signature text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists bounty_submissions_bounty_idx on public.bounty_submissions(bounty_id);

create table if not exists public.bounty_vault_keys (
  bounty_id uuid primary key references public.bounties(id) on delete cascade,
  vault_secret_key text not null,
  created_at timestamptz not null default now()
);

alter table public.bounties enable row level security;
alter table public.bounty_submissions enable row level security;
alter table public.bounty_vault_keys enable row level security;

grant select, insert on public.bounties to authenticated;
grant select on public.bounties to anon;
grant select, insert on public.bounty_submissions to authenticated;
grant select on public.bounty_submissions to anon;

create policy "bounties_public_read" on public.bounties
  for select to anon, authenticated
  using (true);

create policy "bounties_owner_insert" on public.bounties
  for insert to authenticated
  with check (creator_id = auth.uid());

create policy "bounty_submissions_public_read" on public.bounty_submissions
  for select to anon, authenticated
  using (true);

create policy "bounty_submissions_owner_insert" on public.bounty_submissions
  for insert to authenticated
  with check (submitter_id = auth.uid());

create trigger bounties_set_updated_at before update on public.bounties
  for each row execute function public.set_updated_at();
