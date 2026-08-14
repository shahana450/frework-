-- ============================================================
-- FreWork AI Finance — Phase 1 Database Schema
-- Run this entire script in Supabase SQL Editor
-- ============================================================

-- 1. Businesses (tenant root)
CREATE TABLE IF NOT EXISTS fw_fin_businesses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  legal_name text,
  gstin text,
  pan text,
  tan text,
  cin text,
  address text,
  city text,
  state text,
  pincode text,
  email text,
  phone text,
  logo_url text,
  business_type text DEFAULT 'proprietorship', -- proprietorship | partnership | llp | pvt_ltd | public_ltd
  industry text,
  currency text DEFAULT 'INR',
  fiscal_year_start text DEFAULT '04-01', -- MM-DD
  gst_registration_type text DEFAULT 'regular', -- regular | composition | unregistered
  is_active boolean DEFAULT true
);

-- 2. Financial Years
CREATE TABLE IF NOT EXISTS fw_fin_financial_years (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid REFERENCES fw_fin_businesses(id) ON DELETE CASCADE,
  label text NOT NULL, -- "2024-25"
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_current boolean DEFAULT false,
  is_locked boolean DEFAULT false
);

-- 3. Chart of Accounts
CREATE TABLE IF NOT EXISTS fw_fin_chart_of_accounts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid REFERENCES fw_fin_businesses(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  type text NOT NULL, -- asset | liability | equity | income | expense
  sub_type text, -- current_asset | fixed_asset | current_liability | long_term_liability | capital | revenue | direct_expense | indirect_expense | direct_income | indirect_income
  parent_id uuid REFERENCES fw_fin_chart_of_accounts(id),
  is_system boolean DEFAULT false, -- system accounts cannot be deleted
  is_group boolean DEFAULT false, -- group accounts cannot be posted to
  description text,
  sort_order int DEFAULT 0
);

-- 4. Ledger (individual account balances)
CREATE TABLE IF NOT EXISTS fw_fin_ledgers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid REFERENCES fw_fin_businesses(id) ON DELETE CASCADE,
  financial_year_id uuid REFERENCES fw_fin_financial_years(id),
  account_id uuid REFERENCES fw_fin_chart_of_accounts(id),
  opening_balance numeric(15,2) DEFAULT 0,
  opening_balance_type text DEFAULT 'dr', -- dr | cr
  closing_balance numeric(15,2) DEFAULT 0,
  closing_balance_type text DEFAULT 'dr'
);

-- 5. Journal Headers
CREATE TABLE IF NOT EXISTS fw_fin_journals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  business_id uuid REFERENCES fw_fin_businesses(id) ON DELETE CASCADE,
  financial_year_id uuid REFERENCES fw_fin_financial_years(id),
  entry_no text NOT NULL, -- auto-generated: JE/2425/0001
  date date NOT NULL,
  narration text,
  type text DEFAULT 'journal', -- journal | payment | receipt | sales | purchase | contra | debit_note | credit_note
  reference_no text, -- bill/invoice number
  reference_date date,
  status text DEFAULT 'draft', -- draft | posted | voided
  created_by uuid REFERENCES auth.users(id),
  total_debit numeric(15,2) DEFAULT 0,
  total_credit numeric(15,2) DEFAULT 0,
  document_id uuid, -- linked uploaded document
  ai_generated boolean DEFAULT false -- true if created from AI suggestion
);

-- 6. Journal Lines (double-entry)
CREATE TABLE IF NOT EXISTS fw_fin_journal_lines (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  journal_id uuid REFERENCES fw_fin_journals(id) ON DELETE CASCADE,
  account_id uuid REFERENCES fw_fin_chart_of_accounts(id),
  dr_amount numeric(15,2) DEFAULT 0,
  cr_amount numeric(15,2) DEFAULT 0,
  narration text,
  sort_order int DEFAULT 0
);

-- 7. Uploaded Documents (Upload Anything engine)
CREATE TABLE IF NOT EXISTS fw_fin_documents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  business_id uuid REFERENCES fw_fin_businesses(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES auth.users(id),
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size int,
  mime_type text,
  doc_type text, -- invoice | bill | receipt | bank_statement | salary_slip | other
  status text DEFAULT 'pending', -- pending | processing | reviewed | posted | rejected
  ocr_text text, -- raw OCR output
  ai_summary jsonb, -- extracted fields: vendor, amount, date, gst, items[]
  journal_id uuid REFERENCES fw_fin_journals(id) -- linked after posting
);

-- 8. AI Suggestions (pre-bookkeeping)
CREATE TABLE IF NOT EXISTS fw_fin_ai_suggestions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  business_id uuid REFERENCES fw_fin_businesses(id) ON DELETE CASCADE,
  document_id uuid REFERENCES fw_fin_documents(id),
  suggested_type text, -- sales | purchase | expense | payment | receipt
  suggested_narration text,
  suggested_lines jsonb, -- [{account_id, account_name, dr, cr}]
  confidence numeric(3,2), -- 0.00 to 1.00
  status text DEFAULT 'pending', -- pending | accepted | modified | rejected
  accepted_by uuid REFERENCES auth.users(id),
  accepted_at timestamptz,
  journal_id uuid REFERENCES fw_fin_journals(id) -- created journal
);

-- 9. Contacts (Customers & Vendors)
CREATE TABLE IF NOT EXISTS fw_fin_contacts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid REFERENCES fw_fin_businesses(id) ON DELETE CASCADE,
  type text NOT NULL, -- customer | vendor | both
  name text NOT NULL,
  gstin text,
  pan text,
  email text,
  phone text,
  address text,
  city text,
  state text,
  state_code text, -- 2-digit GST state code
  credit_limit numeric(15,2),
  credit_days int DEFAULT 0,
  opening_balance numeric(15,2) DEFAULT 0,
  opening_balance_type text DEFAULT 'dr',
  is_active boolean DEFAULT true
);

-- 10. GST Profile
CREATE TABLE IF NOT EXISTS fw_fin_gst_profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid REFERENCES fw_fin_businesses(id) ON DELETE CASCADE UNIQUE,
  gstin text NOT NULL,
  legal_name text,
  trade_name text,
  registration_date date,
  registration_type text DEFAULT 'regular',
  aggregate_turnover numeric(15,2),
  filing_frequency text DEFAULT 'monthly', -- monthly | quarterly
  auto_itc_claim boolean DEFAULT true
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE fw_fin_businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE fw_fin_financial_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE fw_fin_chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fw_fin_ledgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE fw_fin_journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE fw_fin_journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE fw_fin_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE fw_fin_ai_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fw_fin_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fw_fin_gst_profiles ENABLE ROW LEVEL SECURITY;

-- Business owner policies
CREATE POLICY "business_owner" ON fw_fin_businesses FOR ALL USING (owner_id = auth.uid());

CREATE POLICY "fy_owner" ON fw_fin_financial_years FOR ALL USING (
  business_id IN (SELECT id FROM fw_fin_businesses WHERE owner_id = auth.uid())
);

CREATE POLICY "coa_owner" ON fw_fin_chart_of_accounts FOR ALL USING (
  business_id IN (SELECT id FROM fw_fin_businesses WHERE owner_id = auth.uid())
);

CREATE POLICY "ledger_owner" ON fw_fin_ledgers FOR ALL USING (
  business_id IN (SELECT id FROM fw_fin_businesses WHERE owner_id = auth.uid())
);

CREATE POLICY "journal_owner" ON fw_fin_journals FOR ALL USING (
  business_id IN (SELECT id FROM fw_fin_businesses WHERE owner_id = auth.uid())
);

CREATE POLICY "jline_owner" ON fw_fin_journal_lines FOR ALL USING (
  journal_id IN (
    SELECT j.id FROM fw_fin_journals j
    JOIN fw_fin_businesses b ON b.id = j.business_id
    WHERE b.owner_id = auth.uid()
  )
);

CREATE POLICY "doc_owner" ON fw_fin_documents FOR ALL USING (
  business_id IN (SELECT id FROM fw_fin_businesses WHERE owner_id = auth.uid())
);

CREATE POLICY "ai_owner" ON fw_fin_ai_suggestions FOR ALL USING (
  business_id IN (SELECT id FROM fw_fin_businesses WHERE owner_id = auth.uid())
);

CREATE POLICY "contact_owner" ON fw_fin_contacts FOR ALL USING (
  business_id IN (SELECT id FROM fw_fin_businesses WHERE owner_id = auth.uid())
);

CREATE POLICY "gst_owner" ON fw_fin_gst_profiles FOR ALL USING (
  business_id IN (SELECT id FROM fw_fin_businesses WHERE owner_id = auth.uid())
);

-- Admin override (full access)
CREATE POLICY "admin_businesses" ON fw_fin_businesses FOR ALL USING (
  auth.email() IN ('admin.frework@gmail.com', 'auditmanagercswa@gmail.com')
);

-- 11. Virtual CA Chat History
CREATE TABLE IF NOT EXISTS fw_fin_virtual_ca_chats (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  business_id uuid REFERENCES fw_fin_businesses(id) ON DELETE CASCADE,
  user_message text NOT NULL,
  assistant_reply text NOT NULL
);

ALTER TABLE fw_fin_virtual_ca_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ca_chat_owner" ON fw_fin_virtual_ca_chats FOR ALL USING (
  business_id IN (SELECT id FROM fw_fin_businesses WHERE owner_id = auth.uid())
);

-- ============================================================
-- STORAGE BUCKET (run separately if needed)
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('fw-finance-docs', 'fw-finance-docs', false);
-- CREATE POLICY "owner_upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'fw-finance-docs' AND auth.uid() IS NOT NULL);
-- CREATE POLICY "owner_read" ON storage.objects FOR SELECT USING (bucket_id = 'fw-finance-docs' AND auth.uid() IS NOT NULL);
