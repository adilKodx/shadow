-- ============================================================
-- 00022_partner_portal.sql
-- Phase 1 — Partner self-management portal
--
-- Introduces the concept of a "partner user" — an auth.users row that
-- represents a white-label partner (e.g. someone from Sheperly logs in
-- and manages Sheperly's tenants, branding, pricing, payouts).
--
-- A user may simultaneously be a tenant_member, a platform_admin, and
-- a partner_user. Each role is an additive set of capabilities.
-- ============================================================

-- ─── PARTNER_USERS TABLE ───
CREATE TABLE IF NOT EXISTS partner_users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id  UUID NOT NULL REFERENCES white_label_partners(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('owner','staff')) DEFAULT 'owner',
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by  UUID REFERENCES auth.users(id),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(partner_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_partner_users_user
  ON partner_users(user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_partner_users_partner
  ON partner_users(partner_id);

ALTER TABLE partner_users ENABLE ROW LEVEL SECURITY;

-- ─── self-management toggle ───
-- When the platform owner flips this on, the partner can edit their own
-- partner_pricing rows. When off, only platform admins can edit pricing.
ALTER TABLE white_label_partners
  ADD COLUMN IF NOT EXISTS pricing_self_managed BOOLEAN NOT NULL DEFAULT false;

-- ─── helper: is the current user a partner_user for this partner_id? ───
CREATE OR REPLACE FUNCTION is_partner_user_for(p_partner_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM partner_users
    WHERE user_id = auth.uid()
      AND partner_id = p_partner_id
      AND is_active = true
  );
$$;
GRANT EXECUTE ON FUNCTION is_partner_user_for(UUID) TO authenticated;

-- ─── helper: which partner_id does the current user belong to? ───
-- Returns first active partner membership. NULL if user is not a partner.
CREATE OR REPLACE FUNCTION current_partner_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT partner_id FROM partner_users
   WHERE user_id = auth.uid()
     AND is_active = true
   ORDER BY granted_at ASC
   LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION current_partner_id() TO authenticated;

-- ─── RLS on partner_users ───
-- A user can see their OWN membership row. Platform admins can see all.
DROP POLICY IF EXISTS "pu_self_select" ON partner_users;
CREATE POLICY "pu_self_select" ON partner_users
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_platform_admin());

-- Only platform admins can insert/update/delete partner_user grants.
-- (Partners can't add other partners — that's a platform-owner decision.)
DROP POLICY IF EXISTS "pu_admin_insert" ON partner_users;
CREATE POLICY "pu_admin_insert" ON partner_users
  FOR INSERT TO authenticated WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS "pu_admin_update" ON partner_users;
CREATE POLICY "pu_admin_update" ON partner_users
  FOR UPDATE TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS "pu_admin_delete" ON partner_users;
CREATE POLICY "pu_admin_delete" ON partner_users
  FOR DELETE TO authenticated USING (is_platform_admin());

-- ─── white_label_partners: partner can UPDATE their own row ───
-- Caveat: RLS can't restrict by column. The /partner/branding page must
-- omit commission_pct, slug, is_active, pricing_self_managed from the
-- update payload. RLS still protects the row scope.
DROP POLICY IF EXISTS "wlp_partner_update" ON white_label_partners;
CREATE POLICY "wlp_partner_update" ON white_label_partners
  FOR UPDATE TO authenticated
  USING (is_partner_user_for(id))
  WITH CHECK (is_partner_user_for(id));

-- ─── partner_pricing: partner can write IF pricing_self_managed=true ───
DROP POLICY IF EXISTS "pp_partner_insert" ON partner_pricing;
CREATE POLICY "pp_partner_insert" ON partner_pricing
  FOR INSERT TO authenticated
  WITH CHECK (
    is_partner_user_for(partner_id)
    AND EXISTS (
      SELECT 1 FROM white_label_partners
      WHERE id = partner_id AND pricing_self_managed = true
    )
  );

DROP POLICY IF EXISTS "pp_partner_update" ON partner_pricing;
CREATE POLICY "pp_partner_update" ON partner_pricing
  FOR UPDATE TO authenticated
  USING (
    is_partner_user_for(partner_id)
    AND EXISTS (
      SELECT 1 FROM white_label_partners
      WHERE id = partner_id AND pricing_self_managed = true
    )
  )
  WITH CHECK (
    is_partner_user_for(partner_id)
    AND EXISTS (
      SELECT 1 FROM white_label_partners
      WHERE id = partner_id AND pricing_self_managed = true
    )
  );

DROP POLICY IF EXISTS "pp_partner_delete" ON partner_pricing;
CREATE POLICY "pp_partner_delete" ON partner_pricing
  FOR DELETE TO authenticated
  USING (
    is_partner_user_for(partner_id)
    AND EXISTS (
      SELECT 1 FROM white_label_partners
      WHERE id = partner_id AND pricing_self_managed = true
    )
  );

-- ─── tenants: partner can SELECT their attributed tenants ───
-- (Existing tenant_members RLS unchanged; this is ADDITIVE.)
DROP POLICY IF EXISTS "tenants_partner_select" ON tenants;
CREATE POLICY "tenants_partner_select" ON tenants
  FOR SELECT TO authenticated
  USING (partner_id IS NOT NULL AND is_partner_user_for(partner_id));

-- ─── subscriptions: partner can SELECT their attributed subscriptions ───
DROP POLICY IF EXISTS "subs_partner_select" ON subscriptions;
CREATE POLICY "subs_partner_select" ON subscriptions
  FOR SELECT TO authenticated
  USING (partner_id IS NOT NULL AND is_partner_user_for(partner_id));

-- ─── billing_events: partner can SELECT their commission events ───
DROP POLICY IF EXISTS "be_partner_select" ON billing_events;
CREATE POLICY "be_partner_select" ON billing_events
  FOR SELECT TO authenticated
  USING (partner_id IS NOT NULL AND is_partner_user_for(partner_id));

-- ─── partner_payouts: partner can SELECT their own payouts ───
-- (Platform-admin-only po_admin_* policies stay; this is additive.)
DROP POLICY IF EXISTS "po_partner_select" ON partner_payouts;
CREATE POLICY "po_partner_select" ON partner_payouts
  FOR SELECT TO authenticated
  USING (is_partner_user_for(partner_id));
