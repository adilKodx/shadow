-- ============================================================
-- 00028_fix_encryption_key_search_path.sql
--
-- Fix for the signup-cascade failure exposed by 00027 logging:
--
--   ERROR: signup_trigger failed [42883]:
--   function gen_random_bytes(integer) does not exist
--   ctx: PL/pgSQL function generate_tenant_encryption_key(uuid) line 6
--
-- Root cause: `gen_random_bytes` is provided by the `pgcrypto`
-- extension, which Supabase installs into the `extensions` schema.
-- The pre-existing functions `generate_tenant_encryption_key` and
-- `auto_generate_encryption_key` (from 00006_chat_encryption.sql)
-- never declared a `search_path`, so they relied on the caller's
-- search_path to resolve `gen_random_bytes`.
--
-- The new atomic-signup trigger handle_new_auth_user uses a locked-
-- down search_path (= public, pg_temp) for security, which does NOT
-- include `extensions`. Result: when create_tenant_and_owner inserts
-- a tenant, the cascading BEFORE INSERT trigger tries to call
-- gen_random_bytes and fails.
--
-- This migration replaces both functions to set their own search_path
-- explicitly, making them resilient to whatever search_path the
-- caller is using.
-- ============================================================

CREATE OR REPLACE FUNCTION generate_tenant_encryption_key(p_tenant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_key TEXT;
BEGIN
  -- Generate 32 random bytes, encode as base64.
  -- gen_random_bytes lives in the extensions schema (pgcrypto).
  v_key := encode(gen_random_bytes(32), 'base64');

  INSERT INTO tenant_encryption_keys (tenant_id, key_name, encryption_key)
  VALUES (p_tenant_id, 'chat', v_key)
  ON CONFLICT (tenant_id, key_name) DO NOTHING;

  RETURN v_key;
END;
$$;

CREATE OR REPLACE FUNCTION auto_generate_encryption_key()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  PERFORM generate_tenant_encryption_key(NEW.id);
  RETURN NEW;
END;
$$;
