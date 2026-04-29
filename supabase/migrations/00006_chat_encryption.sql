-- ============================================================
-- ShadowField — Chat Encryption (AES-256-GCM)
-- ============================================================

-- Per-tenant encryption key for chat messages
CREATE TABLE tenant_encryption_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  key_name TEXT NOT NULL DEFAULT 'chat',
  -- Base64-encoded 256-bit AES key (44 chars)
  encryption_key TEXT NOT NULL,
  algorithm TEXT NOT NULL DEFAULT 'AES-256-GCM',
  is_active BOOLEAN DEFAULT true,
  rotated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, key_name)
);

-- RLS: only tenant members can read their org's key
ALTER TABLE tenant_encryption_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tek_select" ON tenant_encryption_keys FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT get_my_tenant_ids()));

-- No insert/update/delete via client — keys are managed by RPC only

-- Add is_encrypted flag to chat_messages so we know which are encrypted
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT false;

-- Add is_encrypted flag to alerts table too
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT false;

-- ─── RPC: Generate encryption key for a tenant ───
-- Called automatically during tenant creation, or manually by admin
CREATE OR REPLACE FUNCTION generate_tenant_encryption_key(p_tenant_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_key TEXT;
BEGIN
  -- Generate 32 random bytes, encode as base64
  v_key := encode(gen_random_bytes(32), 'base64');

  INSERT INTO tenant_encryption_keys (tenant_id, key_name, encryption_key)
  VALUES (p_tenant_id, 'chat', v_key)
  ON CONFLICT (tenant_id, key_name) DO NOTHING;

  RETURN v_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Auto-generate key for existing tenants ───
INSERT INTO tenant_encryption_keys (tenant_id, key_name, encryption_key)
SELECT t.id, 'chat', encode(gen_random_bytes(32), 'base64')
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM tenant_encryption_keys tek
  WHERE tek.tenant_id = t.id AND tek.key_name = 'chat'
);

-- ─── Update create_tenant_and_owner to auto-generate encryption key ───
-- (We add a call at the end of the existing RPC)
-- This is done via a trigger instead for cleaner separation:

CREATE OR REPLACE FUNCTION auto_generate_encryption_key()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM generate_tenant_encryption_key(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_tenant_auto_encryption_key
  AFTER INSERT ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_encryption_key();
