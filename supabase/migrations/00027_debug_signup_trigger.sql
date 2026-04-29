-- ============================================================
-- 00027_debug_signup_trigger.sql
-- Wrap handle_new_auth_user() in an EXCEPTION block that logs
-- the real error to a debug table so we can diagnose without
-- digging through Supabase logs. Re-raises so signup still
-- fails atomically (no orphans).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.signup_trigger_errors (
  id           BIGSERIAL PRIMARY KEY,
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id      UUID,
  email        TEXT,
  metadata     JSONB,
  sqlstate     TEXT,
  err_message  TEXT,
  err_detail   TEXT,
  err_context  TEXT
);

-- Allow service-role and authenticated to read for debugging.
ALTER TABLE public.signup_trigger_errors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_signup_trigger_errors_read ON public.signup_trigger_errors;
CREATE POLICY p_signup_trigger_errors_read
  ON public.signup_trigger_errors
  FOR SELECT
  USING (true);

CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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
  v_state         TEXT;
  v_msg           TEXT;
  v_detail        TEXT;
  v_ctx           TEXT;
BEGIN
  v_meta        := COALESCE(NEW.raw_user_meta_data, '{}'::JSONB);
  v_signup_type := v_meta->>'signup_type';

  IF v_signup_type IS NULL THEN
    RETURN NEW;
  END IF;

  v_display_name := COALESCE(NULLIF(v_meta->>'display_name', ''), NEW.email);

  BEGIN
    IF v_signup_type = 'invite' THEN
      v_invite_code := v_meta->>'invite_code';
      IF v_invite_code IS NULL OR v_invite_code = '' THEN
        RAISE EXCEPTION 'signup_type=invite but invite_code missing';
      END IF;
      SELECT public.join_tenant_with_invite(NEW.id, v_display_name, NEW.email, v_invite_code) INTO v_join_result;
      IF v_join_result IS NOT NULL AND v_join_result->>'error' IS NOT NULL THEN
        RAISE EXCEPTION 'Invite signup failed: %', v_join_result->>'error';
      END IF;
    ELSIF v_signup_type = 'new_tenant' THEN
      v_org_name      := COALESCE(NULLIF(v_meta->>'org_name', ''),     v_display_name || '''s Organization');
      v_partner_slug  := NULLIF(v_meta->>'partner_slug', '');
      v_tier_key      := COALESCE(NULLIF(v_meta->>'tier_key', ''),     'starter');
      v_billing_cycle := COALESCE(NULLIF(v_meta->>'billing_cycle', ''),'monthly');
      PERFORM public.create_tenant_and_owner(NEW.id, NEW.email, v_display_name, v_org_name, v_partner_slug, v_tier_key, v_billing_cycle);
    ELSE
      RAISE EXCEPTION 'Unknown signup_type "%" in user_metadata', v_signup_type;
    END IF;

  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      v_state  = RETURNED_SQLSTATE,
      v_msg    = MESSAGE_TEXT,
      v_detail = PG_EXCEPTION_DETAIL,
      v_ctx    = PG_EXCEPTION_CONTEXT;

    -- Best-effort log to debug table. If even this fails, swallow.
    BEGIN
      INSERT INTO public.signup_trigger_errors (user_id, email, metadata, sqlstate, err_message, err_detail, err_context)
      VALUES (NEW.id, NEW.email, v_meta, v_state, v_msg, v_detail, v_ctx);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- Re-raise so the signup transaction rolls back atomically.
    RAISE EXCEPTION 'signup_trigger failed [%]: % | detail: % | ctx: %', v_state, v_msg, v_detail, v_ctx;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_new_auth_user ON auth.users;
CREATE TRIGGER trg_handle_new_auth_user
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
