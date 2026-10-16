-- Referrals: a new user who signs up with someone's link gets 50% off their first paid month,
-- and the person who referred them gets 50% off their next payment once the new user has paid.
-- Server-only tables (service key); users see their own figures through /api/referral.

create table if not exists fw_referral_codes (
  user_id uuid primary key,
  code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists fw_referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null,
  referred_id uuid not null unique,          -- a person can be referred only once
  code text not null,
  created_at timestamptz not null default now(),
  referred_discount_used boolean not null default false,
  referred_paid_at timestamptz,               -- first payment by the new user → the referrer earns a credit
  referrer_credit_used boolean not null default false,
  check (referrer_id <> referred_id)
);
create index if not exists fw_referrals_referrer on fw_referrals (referrer_id);

alter table fw_referral_codes enable row level security;
alter table fw_referrals enable row level security;
revoke all on fw_referral_codes, fw_referrals from anon, authenticated;
