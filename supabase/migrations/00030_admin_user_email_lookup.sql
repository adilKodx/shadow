-- ══════════════════════════════════════════════════════════════════════
-- 00030 — Platform-admin RPC to look up auth user emails by id
--
-- Why: the WhiteLabelAdmin "Partner Portal Access" table needs to show
-- the email of each partner_users row. We can't query auth.users from
-- the browser, and partner staff often have no tenant_members row to
-- join against, so the previous best-effort lookup was returning NULL
-- and the UI fell back to displaying user_id.
--
-- This RPC is SECURITY DEFINER + an explicit platform_admins guard. It
-- accepts an array of user_ids and returns their email + display_name.
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_user_emails_for_admin(p_user_ids UUID[])
RETURNS TABLE (
  user_id      UUID,
  email        TEXT,
  display_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Only platform admins can call this.
  -- (Table alias required: 'user_id' would otherwise be ambiguous with the
  --  RETURNS TABLE column of the same name.)
  IF NOT EXISTS (
    SELECT 1 FROM platform_admins pa WHERE pa.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only platform admins can look up user emails';
  END IF;

  RETURN QUERY
    SELECT
      u.id,
      u.email::TEXT,
      COALESCE(
        u.raw_user_meta_data->>'display_name',
        u.raw_user_meta_data->>'full_name'
      )::TEXT
    FROM auth.users u
    WHERE u.id = ANY(p_user_ids);
END;
$$;

REVOKE ALL ON FUNCTION get_user_emails_for_admin(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_user_emails_for_admin(UUID[]) TO authenticated;
