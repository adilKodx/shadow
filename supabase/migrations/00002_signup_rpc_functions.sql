-- ============================================================
-- ShadowField — Signup RPC Functions (SECURITY DEFINER)
-- Bypasses RLS for new user signup flow
-- ============================================================

-- Create a new tenant + add user as owner + create default channel
CREATE OR REPLACE FUNCTION create_tenant_and_owner(
  p_user_id UUID,
  p_display_name TEXT,
  p_email TEXT,
  p_org_name TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_slug TEXT;
  v_tenant_id UUID;
  v_channel_id UUID;
BEGIN
  -- Generate slug
  v_slug := lower(regexp_replace(p_org_name, '[^a-zA-Z0-9]', '-', 'g'));
  v_slug := regexp_replace(v_slug, '-+', '-', 'g');
  v_slug := left(v_slug, 40) || '-' || to_hex(extract(epoch FROM now())::int);

  -- Create tenant
  INSERT INTO tenants (name, slug)
  VALUES (p_org_name, v_slug)
  RETURNING id INTO v_tenant_id;

  -- Add user as owner
  INSERT INTO tenant_members (tenant_id, user_id, display_name, email, role)
  VALUES (v_tenant_id, p_user_id, p_display_name, p_email, 'owner');

  -- Create default General channel
  INSERT INTO chat_channels (tenant_id, name, description, channel_type, created_by)
  VALUES (v_tenant_id, 'General', 'General discussion for the team', 'general', p_user_id)
  RETURNING id INTO v_channel_id;

  -- Add user to channel
  INSERT INTO chat_channel_members (channel_id, user_id, role)
  VALUES (v_channel_id, p_user_id, 'admin');

  RETURN jsonb_build_object(
    'tenant_id', v_tenant_id,
    'slug', v_slug,
    'channel_id', v_channel_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Join an existing tenant via invite code
CREATE OR REPLACE FUNCTION join_tenant_with_invite(
  p_user_id UUID,
  p_display_name TEXT,
  p_email TEXT,
  p_invite_code TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_invite RECORD;
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
