-- ── fw_orders: tracks every paid service order ──────────────────────────────
create table if not exists public.fw_orders (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references auth.users(id) on delete set null,
  service_key         text not null,
  service_name        text not null,
  amount_paise        integer not null,
  status              text not null default 'paid',  -- paid | refunded | disputed
  razorpay_order_id   text unique,
  razorpay_payment_id text unique,
  customer_name       text,
  customer_phone      text,
  customer_email      text,
  business_name       text,
  notes               text,
  assigned_ca         text,
  delivery_status     text default 'pending',  -- pending | in_progress | delivered
  paid_at             timestamptz,
  created_at          timestamptz default now()
);

alter table public.fw_orders enable row level security;

-- Users can read their own orders
create policy "Users read own orders"
  on public.fw_orders for select
  using (auth.uid() = user_id);

-- Service role can insert (from verify API)
create policy "Service role insert"
  on public.fw_orders for insert
  with check (true);

-- ── fw_leads: tracks all inquiries (freelancer / coworking / service) ────────
create table if not exists public.fw_leads (
  id          uuid primary key default gen_random_uuid(),
  type        text not null,   -- freelancer_inquiry | coworking_inquiry | service_inquiry
  name        text,
  phone       text,
  email       text,
  message     text,
  meta        jsonb default '{}',
  status      text default 'new',  -- new | contacted | converted | closed
  created_at  timestamptz default now()
);

alter table public.fw_leads enable row level security;

-- Only service role can read/write leads (admin only)
create policy "Service role all"
  on public.fw_leads for all
  using (true);
