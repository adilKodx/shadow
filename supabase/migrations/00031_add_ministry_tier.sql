-- ══════════════════════════════════════════════════════════════════════
-- 00031 — Add 'ministry' to tenants.subscription_tier check constraint
--
-- Bug: tenants.subscription_tier CHECK was defined in 00001 with only
-- ('free','starter','professional','enterprise'), but the 'ministry'
-- tier was added later (subscriptions.tier_key, default_pricing,
-- partner_pricing all support it). Upgrading a tenant to ministry via
-- upgrade_subscription_tier() then fails the constraint.
--
-- Fix: drop the old constraint, add a new one that includes 'ministry'.
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_subscription_tier_check;

ALTER TABLE tenants ADD CONSTRAINT tenants_subscription_tier_check
  CHECK (subscription_tier IN ('free', 'starter', 'professional', 'ministry', 'enterprise'));
