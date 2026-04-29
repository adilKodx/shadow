-- ============================================================================
-- 00029_partner_tenant_members_select
--
-- Adds an additive SELECT policy on `tenant_members` so partner staff can
-- read the contact info of users inside the tenants attributed to them.
--
-- Why: the Partner Portal Tenants tab needs to surface the tenant owner's
-- email so partners can reach out to their own customers without bouncing
-- through ShadowField support. Existing `tm_select` policy is "members of
-- their own tenants only" which excludes partner staff (they aren't members
-- of the customer's tenant).
--
-- Partners can already SELECT the parent `tenants` row (see policy
-- `tenants_partner_select` from 00022). This policy is the natural extension
-- so they can join through to membership rows.
--
-- Existing `tm_select` policy is preserved untouched.
-- ============================================================================

DROP POLICY IF EXISTS "tm_partner_select" ON tenant_members;
CREATE POLICY "tm_partner_select" ON tenant_members
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenants t
      WHERE t.id = tenant_members.tenant_id
        AND t.partner_id IS NOT NULL
        AND is_partner_user_for(t.partner_id)
    )
  );

COMMENT ON POLICY "tm_partner_select" ON tenant_members IS
  'Partners can read membership rows of tenants attributed to them, '
  'so the Partner Portal can surface owner contact info. Additive to tm_select.';
