-- ============================================================
-- 00024_fix_aggregate_payouts_ambiguity.sql
-- Hotfix for 00023.
--
-- aggregate_partner_payouts() declared OUT parameters via
--   RETURNS TABLE (partner_id UUID, payout_id UUID, ...)
-- whose names collide with billing_events columns. Postgres
-- threw "column reference ... is ambiguous" inside the UPDATE
-- block.
--
-- Fixes:
--   1. Add `#variable_conflict use_column` so unqualified
--      references prefer the table column over the PL/pgSQL
--      variable.
--   2. Rename loop record fields to r_* so they can never
--      collide with the OUT parameter names.
--   3. Explicitly qualify the UPDATE WHERE clause with
--      billing_events.*.
--   4. Use date arithmetic (CURRENT_DATE - 7) instead of
--      INTERVAL so defaults stay `date` without coercion.
-- ============================================================

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
#variable_conflict use_column
DECLARE
  v_period_start DATE := COALESCE(p_period_start, CURRENT_DATE - 7);
  v_period_end   DATE := COALESCE(p_period_end, CURRENT_DATE);
  v_payout_id    UUID;
  r              RECORD;
BEGIN
  FOR r IN
    SELECT
      be.partner_id      AS r_partner_id,
      wlp.slug           AS r_partner_slug,
      wlp.commission_pct AS r_commission_pct,
      COUNT(*)::INT      AS r_events_count,
      SUM(be.amount)     AS r_gross_revenue,
      SUM(be.commission_amount) AS r_commission_amount
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
      r.r_partner_id, v_period_start, v_period_end,
      r.r_gross_revenue, r.r_commission_pct, r.r_commission_amount,
      0, r.r_commission_amount,
      'pending', 'ach'
    ) RETURNING id INTO v_payout_id;

    -- Link the events to this payout so they don't aggregate twice.
    -- Explicitly qualify every column to disambiguate from OUT params.
    UPDATE billing_events
       SET payout_id = v_payout_id
     WHERE billing_events.partner_id = r.r_partner_id
       AND billing_events.payout_id IS NULL
       AND billing_events.commission_amount IS NOT NULL
       AND billing_events.commission_amount > 0
       AND billing_events.created_at >= v_period_start
       AND billing_events.created_at < (v_period_end + INTERVAL '1 day');

    partner_id        := r.r_partner_id;
    partner_slug      := r.r_partner_slug;
    payout_id         := v_payout_id;
    events_count      := r.r_events_count;
    gross_revenue     := r.r_gross_revenue;
    commission_amount := r.r_commission_amount;
    RETURN NEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION aggregate_partner_payouts(DATE, DATE) TO authenticated;
