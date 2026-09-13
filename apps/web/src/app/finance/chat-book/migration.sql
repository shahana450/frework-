-- Run in Supabase SQL Editor

-- Chat sessions for bookkeeping conversations
CREATE TABLE IF NOT EXISTS fw_fin_chat_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid REFERENCES fw_fin_businesses(id) ON DELETE CASCADE,
  messages jsonb DEFAULT '[]',
  last_journal_id uuid REFERENCES fw_fin_journals(id) ON DELETE SET NULL,
  last_journal_at timestamptz
);

-- Add source + confirmed_at to journals if missing
ALTER TABLE fw_fin_journals ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';
ALTER TABLE fw_fin_journals ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;

-- Index for rate limiting
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_biz_created ON fw_fin_chat_sessions(user_id, business_id, created_at);
