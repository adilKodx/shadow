-- ============================================================
-- 00025_signup_atomic_trigger.sql
-- Eliminates the split-brain bug where a Supabase auth user could
-- be created without a corresponding tenant_member row.
--
-- THE BUG (root cause):
--   The client previously did this in two separate transactions:
--     1) supabase.auth.signUp(...)        ← creates auth.users row
--     2) supabase.rpc('create_tenant_and_owner', ...)
--   If step 2 failed for ANY reason (network blip, lock contention,
--   transient migration race, browser close), step 1 was already
--   committed and we got an "orphan" auth user with no tenant.
--   ProtectedRoute then bounced them back to /login with no
--   visible error.
--
-- THE FIX (this migration):
--   Move tenant creation into an AFTER INSERT trigger on auth.users.
--   Now the auth user row and the tenant/tenant_member/subscription
--   rows are created in the SAME transaction. If anything fails,
--   the auth user creation also fails — no orphans possible.
--
--   The client passes signup metadata (org_name, partner_slug,
--   tier_key, billing_cycle, invite_code) via supabase.auth.signUp
--   options.data, which lands in auth.users.raw_user_meta_data
--   for the trigger to read.
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
-- Lock down search_path to prevent privilege-escalation via
-- shadowed function names.
SET search_path = public, pg_temp
AS $$
DECLARE
  v_meta          JSONB;
  v_signup_type   TEXT;
  v_display_name  TEXT;
  v_org_name      TEXT;
  v_invite_code   TEXT;
  v_partner_slug  TEXT;
  v_tier_key      TEXT;
  v_billing_cycle TEXT;
  v_join_result   JSON;
BEGIN
  v_meta        := COALESCE(NEW.raw_user_meta_data, '{}'::JSONB);
  v_signup_type := v_meta->>'signup_type';

  -- If no signup_type metadata, this user was created by some other
  -- code path (e.g. platform admin invite flow, partner-staff invite,
  -- or a programmatic insert). Don't try to provision a tenant.
  IF v_signup_type IS NULL THEN
    RETURN NEW;
  END IF;

  v_display_name := COALESCE(NULLIF(v_meta->>'display_name', ''), NEW.email);

  IF v_signup_type = 'invite' THEN
    v_invite_code := v_meta->>'invite_code';
    IF v_invite_code IS NULL OR v_invite_code = '' THEN
      RAISE EXCEPTION 'signup_type=invite but invite_code missing in user_metadata';
    END IF;

    SELECT public.join_tenant_with_invite(
      NEW.id,
      v_display_name,
      NEW.email,
      v_invite_code
    ) INTO v_join_result;

    -- join_tenant_with_invite returns JSON with possible 'error' key.
    IF v_join_result IS NOT NULL AND v_join_result->>'error' IS NOT NULL THEN
      RAISE EXCEPTION 'Invite signup failed: %', v_join_result->>'error';
    END IF;

  ELSIF v_signup_type = 'new_tenant' THEN
    v_org_name      := COALESCE(NULLIF(v_meta->>'org_name', ''),
                                v_display_name || '''s Organization');
    v_partner_slug  := NULLIF(v_meta->>'partner_slug', '');
    v_tier_key      := COALESCE(NULLIF(v_meta->>'tier_key', ''),     'starter');
    v_billing_cycle := COALESCE(NULLIF(v_meta->>'billing_cycle', ''),'monthly');

    PERFORM public.create_tenant_and_owner(
      NEW.id,
      NEW.email,
      v_display_name,
      v_org_name,
      v_partner_slug,
      v_tier_key,
      v_billing_cycle
    );

  ELSE
    -- Unknown signup_type — fail loud so we don't silently corrupt.
    RAISE EXCEPTION 'Unknown signup_type "%" in user_metadata', v_signup_type;
  END IF;

  RETURN NEW;
END;
$$;

-- Replace any prior version of the trigger atomically.
DROP TRIGGER IF EXISTS trg_handle_new_auth_user ON auth.users;
CREATE TRIGGER trg_handle_new_auth_user
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ─── Backfill helper for existing orphan users ───
-- Finds auth.users rows that have signup_type metadata but no
-- tenant_members row, and replays the appropriate provisioning.
-- Safe to run any time — no-ops on already-provisioned users.
CREATE OR REPLACE FUNCTION repair_orphan_auth_users()
RETURNS TABLE (
  user_id    UUID,
  email      TEXT,
  outcome    TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT au.id, au.email, au.raw_user_meta_data
    FROM auth.users au
    LEFT JOIN public.tenant_members tm ON tm.user_id = au.id
    WHERE tm.id IS NULL
      AND au.raw_user_meta_data->>'signup_type' IS NOT NULL
  LOOP
    BEGIN
      PERFORM public.create_tenant_and_owner(
        r.id,
        r.email,
        COALESCE(NULLIF(r.raw_user_meta_data->>'display_name', ''), r.email),
        COALESCE(NULLIF(r.raw_user_meta_data->>'org_name', ''),
                 r.email || '''s Organization'),
        NULLIF(r.raw_user_meta_data->>'partner_slug', ''),
        COALESCE(NULLIF(r.raw_user_meta_data->>'tier_key', ''),     'starter'),
        COALESCE(NULLIF(r.raw_user_meta_data->>'billing_cycle', ''),'monthly')
      );
      user_id := r.id; email := r.email; outcome := 'repaired';
      RETURN NEXT;
    EXCEPTION WHEN OTHERS THEN
      user_id := r.id; email := r.email; outcome := 'failed: ' || SQLERRM;
      RETURN NEXT;
    END;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION repair_orphan_auth_users() TO authenticated;
