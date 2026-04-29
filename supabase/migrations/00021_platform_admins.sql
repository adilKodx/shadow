-- ============================================================
-- 00021_platform_admins.sql
-- Introduce a platform_admins role for ShadowField staff who
-- manage white-label partners, default pricing, and partner
-- payouts. Tenant owners (customer churches) MUST NOT be able
-- to write to these tables.
--
-- This migration:
--   1. Creates platform_admins(user_id, granted_at, granted_by, notes)
--   2. Adds is_platform_admin() helper function
--   3. Adds INSERT/UPDATE/DELETE policies on:
--        - white_label_partners
--        - partner_pricing
--        - default_pricing
--   4. REPLACES the overly-permissive partner_payouts policies
--      (00008_partner_payouts.sql allowed any authenticated user
--      to read/write/delete every payout — a security hole)
--   5. Bootstraps the FIRST user in auth.users as platform admin
-- ============================================================

-- ─── PLATFORM ADMINS TABLE ───
CREATE TABLE IF NOT EXISTS platform_admins (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by UUID REFERENCES auth.users(id),
  notes      TEXT
);

ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;

-- ─── HELPER FUNCTION ───
-- SECURITY DEFINER so it can read platform_admins regardless of the
-- caller's RLS context. STABLE for query planner caching.
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM platform_admins WHERE user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION is_platform_admin() TO anon, authenticated;

-- ─── POLICIES on platform_admins ITSELF ───
-- Only platform admins can see or manage other platform admins.
DROP POLICY IF EXISTS "pa_select" ON platform_admins;
CREATE POLICY "pa_select" ON platform_admins
  FOR SELECT TO authenticated USING (is_platform_admin());

DROP POLICY IF EXISTS "pa_insert" ON platform_admins;
CREATE POLICY "pa_insert" ON platform_admins
  FOR INSERT TO authenticated WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS "pa_update" ON platform_admins;
CREATE POLICY "pa_update" ON platform_admins
  FOR UPDATE TO authenticated USING (is_platform_admin()) WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS "pa_delete" ON platform_admins;
CREATE POLICY "pa_delete" ON platform_admins
  FOR DELETE TO authenticated USING (is_platform_admin());

-- ─── WHITE_LABEL_PARTNERS WRITE POLICIES ───
-- (Existing SELECT policies in 00005 + 00012 remain — public read.)
DROP POLICY IF EXISTS "wlp_admin_insert" ON white_label_partners;
CREATE POLICY "wlp_admin_insert" ON white_label_partners
  FOR INSERT TO authenticated WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS "wlp_admin_update" ON white_label_partners;
CREATE POLICY "wlp_admin_update" ON white_label_partners
  FOR UPDATE TO authenticated USING (is_platform_admin()) WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS "wlp_admin_delete" ON white_label_partners;
CREATE POLICY "wlp_admin_delete" ON white_label_partners
  FOR DELETE TO authenticated USING (is_platform_admin());

-- ─── PARTNER_PRICING WRITE POLICIES ───
DROP POLICY IF EXISTS "pp_admin_insert" ON partner_pricing;
CREATE POLICY "pp_admin_insert" ON partner_pricing
  FOR INSERT TO authenticated WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS "pp_admin_update" ON partner_pricing;
CREATE POLICY "pp_admin_update" ON partner_pricing
  FOR UPDATE TO authenticated USING (is_platform_admin()) WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS "pp_admin_delete" ON partner_pricing;
CREATE POLICY "pp_admin_delete" ON partner_pricing
  FOR DELETE TO authenticated USING (is_platform_admin());

-- ─── DEFAULT_PRICING WRITE POLICIES ───
DROP POLICY IF EXISTS "dp_admin_insert" ON default_pricing;
CREATE POLICY "dp_admin_insert" ON default_pricing
  FOR INSERT TO authenticated WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS "dp_admin_update" ON default_pricing;
CREATE POLICY "dp_admin_update" ON default_pricing
  FOR UPDATE TO authenticated USING (is_platform_admin()) WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS "dp_admin_delete" ON default_pricing;
CREATE POLICY "dp_admin_delete" ON default_pricing
  FOR DELETE TO authenticated USING (is_platform_admin());

-- ─── PARTNER_PAYOUTS — REPLACE OVERLY-PERMISSIVE POLICIES ───
-- 00008 named these `pp_select`, `pp_insert`, `pp_update`, `pp_delete`
-- and allowed ANY authenticated user. Remove them and gate on admin only.
DROP POLICY IF EXISTS "pp_select"  ON partner_payouts;
DROP POLICY IF EXISTS "pp_insert"  ON partner_payouts;
DROP POLICY IF EXISTS "pp_update"  ON partner_payouts;
DROP POLICY IF EXISTS "pp_delete"  ON partner_payouts;

DROP POLICY IF EXISTS "po_admin_select" ON partner_payouts;
CREATE POLICY "po_admin_select" ON partner_payouts
  FOR SELECT TO authenticated USING (is_platform_admin());

DROP POLICY IF EXISTS "po_admin_insert" ON partner_payouts;
CREATE POLICY "po_admin_insert" ON partner_payouts
  FOR INSERT TO authenticated WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS "po_admin_update" ON partner_payouts;
CREATE POLICY "po_admin_update" ON partner_payouts
  FOR UPDATE TO authenticated USING (is_platform_admin()) WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS "po_admin_delete" ON partner_payouts;
CREATE POLICY "po_admin_delete" ON partner_payouts
  FOR DELETE TO authenticated USING (is_platform_admin());

-- ─── BOOTSTRAP: PROMOTE THE FIRST USER TO PLATFORM ADMIN ───
-- The first user in auth.users (oldest by created_at) is conceptually
-- the platform owner who set up this Supabase project. They become
-- the seed admin so the /white-label UI is usable immediately.
--
-- To add another platform admin manually:
--   INSERT INTO platform_admins (user_id, notes)
--   VALUES ('<auth-user-uid>', 'reason / who they are');
--
-- To remove:
--   DELETE FROM platform_admins WHERE user_id = '<auth-user-uid>';
INSERT INTO platform_admins (user_id, notes)
SELECT id, 'Auto-bootstrapped by 00021_platform_admins.sql as first platform admin'
FROM auth.users
ORDER BY created_at ASC
LIMIT 1
ON CONFLICT (user_id) DO NOTHING;
