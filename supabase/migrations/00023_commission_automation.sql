-- ============================================================
-- 00023_commission_automation.sql
-- Phase 2 + 3 — Auto-commission + scheduled payout aggregation
--
-- Phase 2: a BEFORE INSERT trigger on billing_events stamps the row
-- with partner_id and commission_amount based on the subscription's
-- partner_commission_pct at the moment the charge happens.
--
-- Phase 3: aggregate_partner_payouts() rolls up unpaid commission
-- events into a partner_payouts row per partner per period. Scheduled
-- weekly via pg_cron when the extension is available.
-- ============================================================

-- ─── 0. Fix event_type vocabulary mismatch ───
-- 00005 defined a strict CHECK that doesn't match what the helcim-billing
-- edge function actually inserts ('payment','card_updated','card_removed').
-- Replace with a permissive list that matches reality.
ALTER TABLE billing_events
  DROP CONSTRAINT IF EXISTS billing_events_event_type_check;

ALTER TABLE billing_events
  ADD CONSTRAINT billing_events_event_type_check
  CHECK (event_type IN (
    -- canonical (kept from 00005)
    'invoice_created','payment_succeeded','payment_failed',
    'subscription_created','subscription_updated','subscription_canceled',
    'trial_started','trial_ending','trial_ended',
    'refund','credit','commission_paid',
    -- in-use by helcim-billing edge function
    'payment','card_updated','card_removed','upgrade','downgrade'
  ));

-- ─── 1. Link billing_events to a payout (so aggregation is idempotent) ───
ALTER TABLE billing_events
  ADD COLUMN IF NOT EXISTS payout_id UUID REFERENCES partner_payouts(id);

CREATE INDEX IF NOT EXISTS idx_billing_events_unpaid_commission
  ON billing_events(partner_id, payout_id)
  WHERE partner_id IS NOT NULL AND payout_id IS NULL;

-- ─── 2. BEFORE INSERT trigger: auto-stamp partner_id and commission ───
CREATE OR REPLACE FUNCTION stamp_billing_event_commission()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_partner_id UUID;
  v_commission_pct NUMERIC(5,2);
BEGIN
  -- Only stamp on revenue-generating events.
  IF NEW.event_type NOT IN ('payment','payment_succeeded') THEN
    RETURN NEW;
  END IF;

  -- Don't overwrite if caller already provided values.
  IF NEW.partner_id IS NOT NULL AND NEW.commission_amount IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Read partner attribution from the matching subscription.
  -- Prefer subscription_id when caller provides it; otherwise fall back to tenant.
  IF NEW.subscription_id IS NOT NULL THEN
    SELECT s.partner_id, s.partner_commission_pct
      INTO v_partner_id, v_commission_pct
    FROM subscriptions s
    WHERE s.id = NEW.subscription_id;
  ELSIF NEW.tenant_id IS NOT NULL THEN
    SELECT s.partner_id, s.partner_commission_pct
      INTO v_partner_id, v_commission_pct
    FROM subscriptions s
    WHERE s.tenant_id = NEW.tenant_id
      AND s.status IN ('trialing','active','past_due')
    ORDER BY s.created_at DESC
    LIMIT 1;
  END IF;

  -- Stamp only if there's actually a partner attribution.
  IF v_partner_id IS NOT NULL AND NEW.amount IS NOT NULL AND NEW.amount > 0 THEN
    NEW.partner_id := COALESCE(NEW.partner_id, v_partner_id);
    NEW.commission_amount := COALESCE(
      NEW.commission_amount,
      ROUND(NEW.amount * COALESCE(v_commission_pct, 0) / 100, 2)
    );
    -- commission_paid stays its default (false)
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_billing_event_commission ON billing_events;
CREATE TRIGGER trg_stamp_billing_event_commission
  BEFORE INSERT ON billing_events
  FOR EACH ROW EXECUTE FUNCTION stamp_billing_event_commission();

-- ─── 3. Aggregation function ───
-- Rolls up all unpaid commission events into ONE partner_payouts row per
-- partner per (period_start, period_end). Idempotent — events get linked
-- to the payout via billing_events.payout_id so re-running won't double-count.
--
-- Returns one row per partner that received a payout entry.
CREATE OR REPLACE FUNCTION aggregate_partner_payouts(
  p_period_start DATE DEFAULT NULL,
  p_period_end   DATE DEFAULT NULL
)
RETURNS TABLE (
  partner_id        UUID,
  partner_slug      TEXT,
  payout_id         UUID,
  events_count      INT,
  gross_revenue     NUMERIC,
  commission_amount NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_period_start DATE := COALESCE(p_period_start, CURRENT_DATE - INTERVAL '7 days');
  v_period_end   DATE := COALESCE(p_period_end, CURRENT_DATE);
  v_payout_id    UUID;
  r              RECORD;
BEGIN
  FOR r IN
    SELECT
      be.partner_id  AS partner_id,
      wlp.slug       AS partner_slug,
      wlp.commission_pct AS commission_pct,
      COUNT(*)::INT  AS events_count,
      SUM(be.amount) AS gross_revenue,
      SUM(be.commission_amount) AS commission_amount
    FROM billing_events be
    JOIN white_label_partners wlp ON wlp.id = be.partner_id
    WHERE be.partner_id IS NOT NULL
      AND be.payout_id IS NULL
      AND be.commission_amount IS NOT NULL
      AND be.commission_amount > 0
      AND be.created_at >= v_period_start
      AND be.created_at < (v_period_end + INTERVAL '1 day')
    GROUP BY be.partner_id, wlp.slug, wlp.commission_pct
    HAVING SUM(be.commission_amount) > 0
  LOOP
    INSERT INTO partner_payouts (
      partner_id, period_start, period_end,
      gross_revenue, commission_pct, commission_amount,
      adjustments, net_payout,
      status, payment_method
    ) VALUES (
      r.partner_id, v_period_start, v_period_end,
      r.gross_revenue, r.commission_pct, r.commission_amount,
      0, r.commission_amount,
      'pending', 'ach'
    ) RETURNING id INTO v_payout_id;

    -- Link the events to this payout so they don't aggregate twice.
    UPDATE billing_events
       SET payout_id = v_payout_id
     WHERE partner_id = r.partner_id
       AND payout_id IS NULL
       AND commission_amount IS NOT NULL
       AND commission_amount > 0
       AND created_at >= v_period_start
       AND created_at < (v_period_end + INTERVAL '1 day');

    partner_id        := r.partner_id;
    partner_slug      := r.partner_slug;
    payout_id         := v_payout_id;
    events_count      := r.events_count;
    gross_revenue     := r.gross_revenue;
    commission_amount := r.commission_amount;
    RETURN NEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION aggregate_partner_payouts(DATE, DATE) TO authenticated;

-- ─── 4. Mark a payout as paid (helper for platform admin) ───
-- Flips commission_paid=true on every linked event and updates the payout row.
CREATE OR REPLACE FUNCTION confirm_partner_payout(
  p_payout_id   UUID,
  p_paid_at     TIMESTAMPTZ DEFAULT now(),
  p_ach_ref     TEXT DEFAULT NULL,
  p_method      TEXT DEFAULT 'ach'
)
RETURNS partner_payouts
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payout partner_payouts;
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Only platform admins can confirm payouts';
  END IF;

  UPDATE partner_payouts
     SET status               = 'paid',
         payment_date         = p_paid_at::DATE,
         payment_confirmed_at = p_paid_at,
         payment_confirmed_by = auth.uid(),
         ach_reference        = COALESCE(p_ach_ref, ach_reference),
         payment_method       = COALESCE(p_method, payment_method),
         updated_at           = now()
   WHERE id = p_payout_id
   RETURNING * INTO v_payout;

  IF v_payout.id IS NULL THEN
    RAISE EXCEPTION 'Payout % not found', p_payout_id;
  END IF;

  UPDATE billing_events
     SET commission_paid    = true,
         commission_paid_at = p_paid_at
   WHERE payout_id = p_payout_id;

  RETURN v_payout;
END;
$$;

GRANT EXECUTE ON FUNCTION confirm_partner_payout(UUID, TIMESTAMPTZ, TEXT, TEXT) TO authenticated;

-- ─── 5. Try to schedule weekly aggregation via pg_cron ───
-- Runs every Monday 00:00 UTC. Aggregates the prior 7 days.
-- Skipped silently if pg_cron isn't enabled on this Supabase project.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('aggregate_partner_payouts_weekly');
    PERFORM cron.schedule(
      'aggregate_partner_payouts_weekly',
      '0 0 * * 1',
      $cron$SELECT public.aggregate_partner_payouts();$cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
