-- ══════════════════════════════════════════════════════════════════════
-- SIMULATE A SUCCESSFUL PAYMENT (no real Helcim charge)
--
-- Inserts a `billing_events` row with event_type='payment', which fires
-- the `stamp_billing_event_commission` trigger to auto-stamp the partner
-- attribution and commission amount based on the subscription.
--
-- Use this when you want to test the partner commission + payout flow
-- without spending real money via Helcim's sandbox.
--
-- ──────── HOW TO USE ────────
-- 1. Edit the @tenant_slug variable below to match the tenant slug you
--    want to charge (e.g. 'cannt-f13f4b' or whatever shows up in
--    /partner → Tenants → Slug column).
-- 2. Edit @amount if you want a different charge amount (default $100).
-- 3. Paste this whole file into Supabase SQL Editor → Run.
-- 4. Look at the output — should show ONE new billing_events row with
--    partner_id and commission_amount auto-populated.
-- 5. Click "Generate Pending Payouts" in /white-label → Payouts.
-- ══════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  -- ◀───── EDIT THESE ─────▶
  v_tenant_slug TEXT  := 'REPLACE-WITH-TENANT-SLUG';
  v_amount      NUMERIC := 100.00;
  -- ◀────────────────────────▶

  v_tenant_id      UUID;
  v_subscription_id UUID;
  v_event_id       UUID;
BEGIN
  -- 1. Resolve tenant
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = v_tenant_slug;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant with slug "%" not found. Check your slug.', v_tenant_slug;
  END IF;

  -- 2. Find the active subscription for that tenant
  SELECT id INTO v_subscription_id
  FROM subscriptions
  WHERE tenant_id = v_tenant_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_subscription_id IS NULL THEN
    RAISE EXCEPTION 'No subscription for tenant %. Tenant must have signed up via the partner signup flow.', v_tenant_slug;
  END IF;

  -- 3. Insert payment event — trigger handles partner_id + commission
  INSERT INTO billing_events (
    subscription_id,
    tenant_id,
    event_type,
    amount,
    currency,
    description,
    period_start,
    period_end
  ) VALUES (
    v_subscription_id,
    v_tenant_id,
    'payment',
    v_amount,
    'usd',
    'TEST: simulated payment via simulate-payment.sql',
    now(),
    now() + interval '1 month'
  )
  RETURNING id INTO v_event_id;

  RAISE NOTICE 'Inserted billing_events row %: $% for tenant %.',
    v_event_id, v_amount, v_tenant_slug;
END $$;

-- 4. Show the result so you can confirm partner_id + commission_amount got stamped
SELECT
  be.id,
  t.slug          AS tenant_slug,
  wlp.slug        AS partner_slug,
  wlp.commission_pct,
  be.event_type,
  be.amount       AS gross,
  be.commission_amount,
  be.commission_paid,
  be.payout_id,
  be.created_at
FROM billing_events be
JOIN tenants t ON t.id = be.tenant_id
LEFT JOIN white_label_partners wlp ON wlp.id = be.partner_id
WHERE be.description = 'TEST: simulated payment via simulate-payment.sql'
ORDER BY be.created_at DESC
LIMIT 5;
