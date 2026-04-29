-- ============================================================
-- Enforce member caps based on subscription tier.
-- Fix invite RPC to check cap. Remove trial references.
-- ============================================================

-- ─── Helper: get max members for a tenant based on tier ───
CREATE OR REPLACE FUNCTION get_tenant_member_limit(p_tenant_id UUID)
RETURNS INT AS $$
DECLARE
  v_tier TEXT;
  v_partner_id UUID;
  v_limit INT;
BEGIN
  SELECT subscription_tier, partner_id INTO v_tier, v_partner_id
  FROM tenants WHERE id = p_tenant_id;

  IF v_tier IS NULL THEN v_tier := 'starter'; END IF;

  -- Check partner pricing first
  IF v_partner_id IS NOT NULL THEN
    SELECT max_members INTO v_limit
    FROM partner_pricing
    WHERE partner_id = v_partner_id AND tier_key = v_tier AND is_active = true;
  END IF;

  -- Fallback to default pricing
  IF v_limit IS NULL THEN
    SELECT max_members INTO v_limit
    FROM default_pricing
    WHERE tier_key = v_tier AND is_active = true;
  END IF;

  RETURN COALESCE(v_limit, 3); -- absolute fallback
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ─── Helper: get current active member count ───
CREATE OR REPLACE FUNCTION get_tenant_member_count(p_tenant_id UUID)
RETURNS INT AS $$
  SELECT COUNT(*)::INT FROM tenant_members
  WHERE tenant_id = p_tenant_id AND is_active = true;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── Fix join_tenant_with_invite to enforce cap ───
CREATE OR REPLACE FUNCTION join_tenant_with_invite(
  p_user_id UUID,
  p_display_name TEXT,
  p_email TEXT,
  p_invite_code TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_invite RECORD;
  v_current_count INT;
  v_max_members INT;
BEGIN
  -- Find valid invite
  SELECT * INTO v_invite
  FROM tenant_invites
  WHERE code = p_invite_code
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now());

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Invalid or expired invite code');
  END IF;

  -- Check max uses
  IF v_invite.max_uses > 0 AND v_invite.used_count >= v_invite.max_uses THEN
    RETURN jsonb_build_object('error', 'Invite code has reached its maximum uses');
  END IF;

  -- Check if user is already a member
  IF EXISTS (SELECT 1 FROM tenant_members WHERE tenant_id = v_invite.tenant_id AND user_id = p_user_id) THEN
    RETURN jsonb_build_object('error', 'You are already a member of this organization');
  END IF;

  -- *** ENFORCE MEMBER CAP ***
  v_current_count := get_tenant_member_count(v_invite.tenant_id);
  v_max_members := get_tenant_member_limit(v_invite.tenant_id);

  IF v_current_count >= v_max_members THEN
    RETURN jsonb_build_object(
      'error', 'This organization has reached its member limit (' || v_max_members || '). The admin needs to upgrade the plan to add more members.',
      'limit_reached', true,
      'current_count', v_current_count,
      'max_members', v_max_members
    );
  END IF;

  -- Add user as member
  INSERT INTO tenant_members (tenant_id, user_id, display_name, email, role)
  VALUES (v_invite.tenant_id, p_user_id, p_display_name, p_email, COALESCE(v_invite.role, 'member'));

  -- Increment used count
  UPDATE tenant_invites SET used_count = used_count + 1 WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'tenant_id', v_invite.tenant_id,
    'role', COALESCE(v_invite.role, 'member')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Sync tenants.max_members to match their subscription tier ───
UPDATE tenants t SET max_members = COALESCE(
  (SELECT dp.max_members FROM default_pricing dp WHERE dp.tier_key = t.subscription_tier AND dp.is_active = true),
  3
);

-- ─── Fix create_tenant_and_owner: status='active' not 'trialing', no trial references ───
CREATE OR REPLACE FUNCTION create_tenant_and_owner(
  p_user_id UUID,
  p_email TEXT,
  p_display_name TEXT,
  p_org_name TEXT,
  p_partner_slug TEXT DEFAULT NULL,
  p_tier_key TEXT DEFAULT 'starter',
  p_billing_cycle TEXT DEFAULT 'monthly'
)
RETURNS JSON AS $$
DECLARE
  v_tenant_id UUID;
  v_slug TEXT;
  v_partner_id UUID;
  v_base_price NUMERIC;
  v_discount NUMERIC;
  v_effective_price NUMERIC;
  v_commission NUMERIC := 0;
  v_channel_id UUID;
  v_max_members INT;
BEGIN
  -- Look up partner
  IF p_partner_slug IS NOT NULL THEN
    SELECT id, commission_pct INTO v_partner_id, v_commission
    FROM white_label_partners
    WHERE slug = p_partner_slug AND is_active = true;
  END IF;

  -- Look up pricing
  IF v_partner_id IS NOT NULL THEN
    SELECT monthly_price, annual_discount_pct, max_members
    INTO v_base_price, v_discount, v_max_members
    FROM partner_pricing
    WHERE partner_id = v_partner_id AND tier_key = p_tier_key AND is_active = true;
  END IF;

  -- Fallback to default pricing
  IF v_base_price IS NULL THEN
    SELECT monthly_price, annual_discount_pct, max_members
    INTO v_base_price, v_discount, v_max_members
    FROM default_pricing
    WHERE tier_key = p_tier_key AND is_active = true;
  END IF;

  -- Defaults
  IF v_base_price IS NULL THEN v_base_price := 25.00; END IF;
  IF v_discount IS NULL THEN v_discount := 20.00; END IF;
  IF v_max_members IS NULL THEN v_max_members := 3; END IF;

  IF p_billing_cycle = 'annual' THEN
    v_effective_price := v_base_price * 12 * (1 - v_discount / 100);
  ELSE
    v_effective_price := v_base_price;
  END IF;

  -- Create tenant with correct max_members from tier
  v_slug := lower(regexp_replace(p_org_name, '[^a-zA-Z0-9]', '-', 'g'));
  v_slug := v_slug || '-' || substr(gen_random_uuid()::text, 1, 6);

  INSERT INTO tenants (name, slug, partner_id, subscription_tier, billing_cycle, max_members)
  VALUES (p_org_name, v_slug, v_partner_id, p_tier_key, p_billing_cycle, v_max_members)
  RETURNING id INTO v_tenant_id;

  -- Add owner
  INSERT INTO tenant_members (tenant_id, user_id, display_name, email, role)
  VALUES (v_tenant_id, p_user_id, p_display_name, p_email, 'owner');

  -- Create subscription — status 'active', no trial
  INSERT INTO subscriptions (tenant_id, tier_key, billing_cycle, base_price, discount_pct,
    effective_price, partner_id, partner_commission_pct, status,
    trial_ends_at, current_period_start, current_period_end)
  VALUES (
    v_tenant_id, p_tier_key, p_billing_cycle, v_base_price,
    CASE WHEN p_billing_cycle = 'annual' THEN v_discount ELSE 0 END,
    v_effective_price, v_partner_id, v_commission,
    'active',  -- credit card required at signup, no trial
    NULL,      -- no trial end date
    now(),
    CASE WHEN p_billing_cycle = 'annual' THEN now() + interval '1 year' ELSE now() + interval '1 month' END
  );

  -- Log billing event
  INSERT INTO billing_events (subscription_id, tenant_id, event_type, amount, partner_id, commission_amount, description, period_start, period_end)
  SELECT s.id, v_tenant_id, 'subscription_created', v_effective_price, v_partner_id,
    v_effective_price * v_commission / 100, 'Subscription activated', now(),
    CASE WHEN p_billing_cycle = 'annual' THEN now() + interval '1 year' ELSE now() + interval '1 month' END
  FROM subscriptions s WHERE s.tenant_id = v_tenant_id LIMIT 1;

  -- Default chat channel
  INSERT INTO chat_channels (tenant_id, name, description, channel_type, created_by)
  VALUES (v_tenant_id, 'General', 'Main team channel', 'general', p_user_id)
  RETURNING id INTO v_channel_id;

  INSERT INTO chat_channel_members (channel_id, user_id, role)
  VALUES (v_channel_id, p_user_id, 'admin');

  RETURN json_build_object('tenant_id', v_tenant_id, 'partner_id', v_partner_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── RPC for upgrading subscription tier (called from UI) ───
CREATE OR REPLACE FUNCTION upgrade_subscription_tier(
  p_tenant_id UUID,
  p_new_tier TEXT
)
RETURNS JSON AS $$
DECLARE
  v_sub RECORD;
  v_new_price NUMERIC;
  v_new_discount NUMERIC;
  v_new_max INT;
  v_partner_id UUID;
  v_effective NUMERIC;
BEGIN
  -- Get current subscription
  SELECT * INTO v_sub FROM subscriptions
  WHERE tenant_id = p_tenant_id
  ORDER BY created_at DESC LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'No subscription found');
  END IF;

  -- Get partner_id from tenant
  SELECT partner_id INTO v_partner_id FROM tenants WHERE id = p_tenant_id;

  -- Look up new tier pricing
  IF v_partner_id IS NOT NULL THEN
    SELECT monthly_price, annual_discount_pct, max_members
    INTO v_new_price, v_new_discount, v_new_max
    FROM partner_pricing
    WHERE partner_id = v_partner_id AND tier_key = p_new_tier AND is_active = true;
  END IF;

  IF v_new_price IS NULL THEN
    SELECT monthly_price, annual_discount_pct, max_members
    INTO v_new_price, v_new_discount, v_new_max
    FROM default_pricing
    WHERE tier_key = p_new_tier AND is_active = true;
  END IF;

  IF v_new_price IS NULL THEN
    RETURN json_build_object('error', 'Invalid tier');
  END IF;

  -- Calculate effective price
  IF v_sub.billing_cycle = 'annual' THEN
    v_effective := v_new_price * 12 * (1 - COALESCE(v_new_discount, 20) / 100);
  ELSE
    v_effective := v_new_price;
  END IF;

  -- Update subscription
  UPDATE subscriptions SET
    tier_key = p_new_tier,
    base_price = v_new_price,
    effective_price = v_effective,
    updated_at = now()
  WHERE id = v_sub.id;

  -- Update tenant
  UPDATE tenants SET
    subscription_tier = p_new_tier,
    max_members = v_new_max,
    updated_at = now()
  WHERE id = p_tenant_id;

  -- Log event
  INSERT INTO billing_events (subscription_id, tenant_id, event_type, amount, description)
  VALUES (v_sub.id, p_tenant_id, 'subscription_updated', v_effective,
    'Upgraded to ' || p_new_tier || ' plan (' || v_new_max || ' members)');

  RETURN json_build_object(
    'success', true,
    'tier', p_new_tier,
    'max_members', v_new_max,
    'effective_price', v_effective
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
