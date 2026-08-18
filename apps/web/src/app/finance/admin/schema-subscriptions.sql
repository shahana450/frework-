-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS fw_fin_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan text NOT NULL DEFAULT 'professional',
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'trial', -- trial | active | cancelled | expired
  payment_id text,
  order_id text,
  trial_ends_at timestamptz,
  subscription_ends_at timestamptz,
  granted_by_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- RLS
ALTER TABLE fw_fin_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own subscription"
  ON fw_fin_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Service role (used by admin API) bypasses RLS automatically
