-- ─── FIX create_tenant_and_owner RPC ───
-- Bug: inserts into chat_channel_members (display_name) but that column doesn't exist on that table.
-- The display_name belongs on tenant_members, not chat_channel_members.
-- This caused new tenant creation to fail with:
--   "column 'display_name' of relation 'chat_channel_members' does not exist"

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
BEGIN
  -- Look up partner
  IF p_partner_slug IS NOT NULL THEN
    SELECT id, commission_pct INTO v_partner_id, v_commission
    FROM white_label_partners
    WHERE slug = p_partner_slug AND is_active = true;
  END IF;

  -- Look up pricing
  IF v_partner_id IS NOT NULL THEN
    SELECT monthly_price, annual_discount_pct
    INTO v_base_price, v_discount
    FROM partner_pricing
    WHERE partner_id = v_partner_id AND tier_key = p_tier_key AND is_active = true;
  END IF;

  -- Fallback to default pricing
  IF v_base_price IS NULL THEN
    SELECT monthly_price, annual_discount_pct
    INTO v_base_price, v_discount
    FROM default_pricing
    WHERE tier_key = p_tier_key AND is_active = true;
  END IF;

  -- Calculate effective price
  IF v_base_price IS NULL THEN v_base_price := 25.00; END IF;
  IF v_discount IS NULL THEN v_discount := 20.00; END IF;

  IF p_billing_cycle = 'annual' THEN
    v_effective_price := v_base_price * 12 * (1 - v_discount / 100);
  ELSE
    v_effective_price := v_base_price;
  END IF;

  -- Create tenant
  v_slug := lower(regexp_replace(p_org_name, '[^a-zA-Z0-9]', '-', 'g'));
  v_slug := v_slug || '-' || substr(gen_random_uuid()::text, 1, 6);

  INSERT INTO tenants (name, slug, partner_id, subscription_tier, billing_cycle)
  VALUES (p_org_name, v_slug, v_partner_id, p_tier_key, p_billing_cycle)
  RETURNING id INTO v_tenant_id;

  -- Add owner
  INSERT INTO tenant_members (tenant_id, user_id, display_name, email, role)
  VALUES (v_tenant_id, p_user_id, p_display_name, p_email, 'owner');

  -- Create subscription
  INSERT INTO subscriptions (tenant_id, tier_key, billing_cycle, base_price, discount_pct, effective_price, partner_id, partner_commission_pct, status, trial_ends_at, current_period_start, current_period_end)
  VALUES (
    v_tenant_id, p_tier_key, p_billing_cycle, v_base_price,
    CASE WHEN p_billing_cycle = 'annual' THEN v_discount ELSE 0 END,
    v_effective_price, v_partner_id, v_commission, 'trialing',
    now() + interval '14 days', now(),
    CASE WHEN p_billing_cycle = 'annual' THEN now() + interval '1 year' ELSE now() + interval '1 month' END
  );

  -- Log billing event
  INSERT INTO billing_events (subscription_id, tenant_id, event_type, amount, partner_id, commission_amount, description, period_start, period_end)
  SELECT s.id, v_tenant_id, 'trial_started', 0, v_partner_id,
    0, 'Free 14-day trial started', now(), now() + interval '14 days'
  FROM subscriptions s WHERE s.tenant_id = v_tenant_id;

  -- Default chat channel
  INSERT INTO chat_channels (tenant_id, name, description, is_default)
  VALUES (v_tenant_id, 'General', 'Main team channel', true)
  RETURNING id INTO v_channel_id;

  -- FIX: drop display_name (not a column on chat_channel_members),
  -- add role='admin' so the owner can manage the channel.
  INSERT INTO chat_channel_members (channel_id, user_id, role)
  VALUES (v_channel_id, p_user_id, 'admin');

  RETURN json_build_object('tenant_id', v_tenant_id, 'partner_id', v_partner_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
