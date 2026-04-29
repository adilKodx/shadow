-- ============================================================
-- Partner / Referrer Payout Tracking
-- Payments processed via QuickBooks externally.
-- This table tracks ACH transfers, amounts, and confirmation.
-- Partners are paid 30 days from receipt of customer payment.
-- ============================================================

CREATE TABLE IF NOT EXISTS partner_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES white_label_partners(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  -- Calculated from billing events
  gross_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  commission_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  commission_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  adjustments NUMERIC(12,2) DEFAULT 0,
  net_payout NUMERIC(12,2) NOT NULL DEFAULT 0,
  -- Payment tracking
  status TEXT NOT NULL CHECK (status IN ('pending','scheduled','processing','paid','failed','cancelled')) DEFAULT 'pending',
  payment_method TEXT CHECK (payment_method IN ('ach','check','wire','other')) DEFAULT 'ach',
  ach_tracking_number TEXT,
  ach_reference TEXT,
  payment_date DATE,
  payment_confirmed_at TIMESTAMPTZ,
  payment_confirmed_by UUID REFERENCES auth.users(id),
  -- QuickBooks reference
  qb_bill_id TEXT,
  qb_payment_id TEXT,
  -- Notes
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_payouts_partner ON partner_payouts(partner_id, status);
CREATE INDEX IF NOT EXISTS idx_partner_payouts_status ON partner_payouts(status);

-- RLS
ALTER TABLE partner_payouts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "pp_select" ON partner_payouts FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "pp_insert" ON partner_payouts FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "pp_update" ON partner_payouts FOR UPDATE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "pp_delete" ON partner_payouts FOR DELETE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
