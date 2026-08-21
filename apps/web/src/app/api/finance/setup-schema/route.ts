import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SCHEMA_SQL = `
-- fw_fin_businesses
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
  business_type text DEFAULT 'sole_proprietorship',
  gst_registration_type text DEFAULT 'unregistered',
  financial_year_start text DEFAULT '04-01',
  currency text DEFAULT 'INR',
  is_active boolean DEFAULT true
);

-- fw_fin_financial_years
CREATE TABLE IF NOT EXISTS fw_fin_financial_years (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  business_id uuid REFERENCES fw_fin_businesses(id) ON DELETE CASCADE,
  label text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_current boolean DEFAULT false,
  is_closed boolean DEFAULT false
);

-- fw_fin_chart_of_accounts
CREATE TABLE IF NOT EXISTS fw_fin_chart_of_accounts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  business_id uuid REFERENCES fw_fin_businesses(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  type text NOT NULL,
  sub_type text,
  parent_id uuid REFERENCES fw_fin_chart_of_accounts(id),
  is_group boolean DEFAULT false,
  description text,
  opening_balance numeric(15,2) DEFAULT 0,
  opening_balance_type text DEFAULT 'Dr'
);

-- fw_fin_ledgers
CREATE TABLE IF NOT EXISTS fw_fin_ledgers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  business_id uuid REFERENCES fw_fin_businesses(id) ON DELETE CASCADE,
  account_id uuid REFERENCES fw_fin_chart_of_accounts(id),
  fy_id uuid REFERENCES fw_fin_financial_years(id),
  opening_balance numeric(15,2) DEFAULT 0,
  opening_balance_type text DEFAULT 'Dr',
  closing_balance numeric(15,2) DEFAULT 0,
  closing_balance_type text DEFAULT 'Dr'
);

-- fw_fin_contacts
CREATE TABLE IF NOT EXISTS fw_fin_contacts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  business_id uuid REFERENCES fw_fin_businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text DEFAULT 'customer',
  gstin text,
  pan text,
  email text,
  phone text,
  address text,
  city text,
  state text,
  pincode text,
  credit_days integer DEFAULT 30,
  opening_balance numeric(15,2) DEFAULT 0,
  opening_balance_type text DEFAULT 'Dr'
);

-- fw_fin_documents
CREATE TABLE IF NOT EXISTS fw_fin_documents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  business_id uuid REFERENCES fw_fin_businesses(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES auth.users(id),
  file_name text NOT NULL,
  file_url text,
  file_size integer,
  mime_type text,
  doc_type text,
  status text DEFAULT 'pending',
  ai_summary jsonb
);

-- fw_fin_journals
CREATE TABLE IF NOT EXISTS fw_fin_journals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  business_id uuid REFERENCES fw_fin_businesses(id) ON DELETE CASCADE,
  fy_id uuid REFERENCES fw_fin_financial_years(id),
  entry_no text,
  date date NOT NULL,
  type text DEFAULT 'journal',
  narration text,
  reference_no text,
  contact_id uuid REFERENCES fw_fin_contacts(id),
  total_debit numeric(15,2) DEFAULT 0,
  total_credit numeric(15,2) DEFAULT 0,
  status text DEFAULT 'draft',
  ai_generated boolean DEFAULT false,
  document_id uuid REFERENCES fw_fin_documents(id)
);

-- fw_fin_journal_lines
CREATE TABLE IF NOT EXISTS fw_fin_journal_lines (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  journal_id uuid REFERENCES fw_fin_journals(id) ON DELETE CASCADE,
  account_id uuid REFERENCES fw_fin_chart_of_accounts(id),
  dr_amount numeric(15,2) DEFAULT 0,
  cr_amount numeric(15,2) DEFAULT 0,
  narration text
);

-- fw_fin_ai_suggestions
CREATE TABLE IF NOT EXISTS fw_fin_ai_suggestions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  business_id uuid REFERENCES fw_fin_businesses(id) ON DELETE CASCADE,
  document_id uuid REFERENCES fw_fin_documents(id),
  suggested_type text,
  suggested_narration text,
  suggested_lines jsonb,
  confidence numeric(4,3) DEFAULT 0.85,
  status text DEFAULT 'pending',
  posted_journal_id uuid REFERENCES fw_fin_journals(id)
);

-- fw_fin_gst_profiles
CREATE TABLE IF NOT EXISTS fw_fin_gst_profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  business_id uuid REFERENCES fw_fin_businesses(id) ON DELETE CASCADE,
  gstin text,
  legal_name text,
  trade_name text,
  registration_date date,
  state_code text,
  gst_type text DEFAULT 'regular'
);

-- fw_fin_virtual_ca_chats
CREATE TABLE IF NOT EXISTS fw_fin_virtual_ca_chats (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  business_id uuid REFERENCES fw_fin_businesses(id) ON DELETE CASCADE,
  user_message text NOT NULL,
  assistant_reply text NOT NULL
);

-- RLS
ALTER TABLE fw_fin_businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE fw_fin_financial_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE fw_fin_chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fw_fin_ledgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE fw_fin_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fw_fin_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE fw_fin_journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE fw_fin_journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE fw_fin_ai_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fw_fin_gst_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE fw_fin_virtual_ca_chats ENABLE ROW LEVEL SECURITY;

-- Policies (IF NOT EXISTS workaround: drop and recreate)
DO $$ BEGIN
  DROP POLICY IF EXISTS "biz_owner" ON fw_fin_businesses;
  CREATE POLICY "biz_owner" ON fw_fin_businesses FOR ALL USING (owner_id = auth.uid() OR auth.email() IN ('admin.frework@gmail.com','admin.frework@gmail.com'));

  DROP POLICY IF EXISTS "fy_owner" ON fw_fin_financial_years;
  CREATE POLICY "fy_owner" ON fw_fin_financial_years FOR ALL USING (business_id IN (SELECT id FROM fw_fin_businesses WHERE owner_id = auth.uid()));

  DROP POLICY IF EXISTS "coa_owner" ON fw_fin_chart_of_accounts;
  CREATE POLICY "coa_owner" ON fw_fin_chart_of_accounts FOR ALL USING (business_id IN (SELECT id FROM fw_fin_businesses WHERE owner_id = auth.uid()));

  DROP POLICY IF EXISTS "ledger_owner" ON fw_fin_ledgers;
  CREATE POLICY "ledger_owner" ON fw_fin_ledgers FOR ALL USING (business_id IN (SELECT id FROM fw_fin_businesses WHERE owner_id = auth.uid()));

  DROP POLICY IF EXISTS "contact_owner" ON fw_fin_contacts;
  CREATE POLICY "contact_owner" ON fw_fin_contacts FOR ALL USING (business_id IN (SELECT id FROM fw_fin_businesses WHERE owner_id = auth.uid()));

  DROP POLICY IF EXISTS "doc_owner" ON fw_fin_documents;
  CREATE POLICY "doc_owner" ON fw_fin_documents FOR ALL USING (business_id IN (SELECT id FROM fw_fin_businesses WHERE owner_id = auth.uid()));

  DROP POLICY IF EXISTS "journal_owner" ON fw_fin_journals;
  CREATE POLICY "journal_owner" ON fw_fin_journals FOR ALL USING (business_id IN (SELECT id FROM fw_fin_businesses WHERE owner_id = auth.uid()));

  DROP POLICY IF EXISTS "jline_owner" ON fw_fin_journal_lines;
  CREATE POLICY "jline_owner" ON fw_fin_journal_lines FOR ALL USING (
    journal_id IN (SELECT id FROM fw_fin_journals WHERE business_id IN (SELECT id FROM fw_fin_businesses WHERE owner_id = auth.uid()))
  );

  DROP POLICY IF EXISTS "ai_owner" ON fw_fin_ai_suggestions;
  CREATE POLICY "ai_owner" ON fw_fin_ai_suggestions FOR ALL USING (business_id IN (SELECT id FROM fw_fin_businesses WHERE owner_id = auth.uid()));

  DROP POLICY IF EXISTS "gst_owner" ON fw_fin_gst_profiles;
  CREATE POLICY "gst_owner" ON fw_fin_gst_profiles FOR ALL USING (business_id IN (SELECT id FROM fw_fin_businesses WHERE owner_id = auth.uid()));

  DROP POLICY IF EXISTS "ca_chat_owner" ON fw_fin_virtual_ca_chats;
  CREATE POLICY "ca_chat_owner" ON fw_fin_virtual_ca_chats FOR ALL USING (business_id IN (SELECT id FROM fw_fin_businesses WHERE owner_id = auth.uid()));
END $$;
`;

export async function POST(req: NextRequest) {
  try {
    // Verify user is admin
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const adminEmails = ["admin.frework@gmail.com", "admin.frework@gmail.com"];
    if (!adminEmails.includes(user.email ?? "")) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    // Execute schema SQL
    const { error } = await supabase.rpc("exec_sql", { sql: SCHEMA_SQL }).single();

    if (error) {
      // Try direct approach — split into individual statements
      const statements = SCHEMA_SQL.split(";").map(s => s.trim()).filter(s => s.length > 10);
      const errors: string[] = [];

      for (const stmt of statements) {
        const { error: stmtErr } = await supabase.rpc("exec_sql", { sql: stmt + ";" }).single();
        if (stmtErr && !stmtErr.message.includes("already exists")) {
          errors.push(stmtErr.message);
        }
      }

      if (errors.length > 0) {
        return NextResponse.json({
          message: "Schema setup completed with some warnings",
          errors,
          sql: SCHEMA_SQL
        });
      }
    }

    return NextResponse.json({ success: true, message: "Schema created successfully" });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// GET — return the SQL for manual execution
export async function GET() {
  return new Response(SCHEMA_SQL, {
    headers: {
      "Content-Type": "text/plain",
      "Content-Disposition": 'attachment; filename="fw_fin_schema.sql"',
    },
  });
}

