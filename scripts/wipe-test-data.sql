-- ══════════════════════════════════════════════════════════════════════
-- WIPE TEST DATA — keeps only the platform owner
--
-- Deletes:
--   • All white-label partners (Sheperly, eidhi, etc.) + their pricing
--     overrides, partner_users grants, partner_payouts
--   • All tenants (cascades to subscriptions, billing_events,
--     tenant_members, alerts, incidents, SOPs, chat, locations, ...)
--   • All auth.users EXCEPT leith@imagi-tech.com
--
-- Keeps:
--   • leith@imagi-tech.com auth user
--   • leith's platform_admins row
--   • default_pricing tiers (needed for direct signups)
--   • terms_versions
--   • marketing_settings (incl. helcim_api_token)
--
-- HOW TO RUN:
--   1. Open Supabase Dashboard → SQL Editor
--   2. Paste this whole file
--   3. Run.
--   4. Look at the final SELECT (counts of remaining rows). If anything
--      looks wrong, run `ROLLBACK;` immediately. Otherwise you're done.
--
-- NOTE: this does NOT delete files in storage buckets (tenant logos,
-- avatars, etc.). Those are harmless leftovers but if you want them
-- gone, do it from the Supabase Storage UI.
-- ══════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. Sanity: Leith must exist ─────────────────────────────────────
DO $$
DECLARE
  v_leith_id UUID;
BEGIN
  SELECT id INTO v_leith_id
  FROM auth.users
  WHERE email = 'leith@imagi-tech.com';

  IF v_leith_id IS NULL THEN
    RAISE EXCEPTION
      'Aborting: leith@imagi-tech.com not found in auth.users. '
      'Refusing to wipe — would lock you out.';
  END IF;
  RAISE NOTICE 'Leith user_id: %', v_leith_id;
END $$;

-- ─── 2. Show what's about to die ─────────────────────────────────────
DO $$
DECLARE
  v_tenants     INT;
  v_partners    INT;
  v_users       INT;
  v_subs        INT;
  v_events      INT;
  v_payouts     INT;
BEGIN
  SELECT count(*) INTO v_tenants  FROM tenants;
  SELECT count(*) INTO v_partners FROM white_label_partners;
  SELECT count(*) INTO v_users    FROM auth.users WHERE email <> 'leith@imagi-tech.com';
  SELECT count(*) INTO v_subs     FROM subscriptions;
  SELECT count(*) INTO v_events   FROM billing_events;
  SELECT count(*) INTO v_payouts  FROM partner_payouts;
  RAISE NOTICE 'About to delete: % tenants, % partners, % users, % subs, % billing_events, % payouts',
    v_tenants, v_partners, v_users, v_subs, v_events, v_payouts;
END $$;

-- ─── 3a. Terms acceptances ── tenant_id has no ON DELETE CASCADE,
--   so we have to clear these manually first or the tenant DELETE fails.
DELETE FROM terms_acceptances;

-- ─── 3b. Tenants ── cascades into:
--   subscriptions, billing_events, tenant_members, tenant_invites,
--   chat_*, alerts, incidents, sops, action_plans, news_posts,
--   poi_records, video_feeds, member_locations, map_zones,
--   map_overlays, geofence_events, attendance_*, activity_log, etc.
DELETE FROM tenants;

-- ─── 4. White-label partners ── cascades into:
--   partner_users, partner_pricing, partner_payouts
DELETE FROM white_label_partners;

-- ─── 5. Other auth.users ── cascades into:
--   tenant_members (already gone), partner_users (already gone),
--   platform_admins (other admins, if any), terms_acceptances
DELETE FROM auth.users WHERE email <> 'leith@imagi-tech.com';

-- ─── 6. Make sure Leith is still a platform admin (idempotent) ───────
INSERT INTO platform_admins (user_id, granted_by)
SELECT u.id, u.id
FROM auth.users u
WHERE u.email = 'leith@imagi-tech.com'
ON CONFLICT (user_id) DO NOTHING;

-- ─── 7. Final tally ──────────────────────────────────────────────────
SELECT 'auth.users'              AS table_name, count(*) AS remaining FROM auth.users
UNION ALL SELECT 'platform_admins',      count(*) FROM platform_admins
UNION ALL SELECT 'tenants',              count(*) FROM tenants
UNION ALL SELECT 'tenant_members',       count(*) FROM tenant_members
UNION ALL SELECT 'white_label_partners', count(*) FROM white_label_partners
UNION ALL SELECT 'partner_users',        count(*) FROM partner_users
UNION ALL SELECT 'partner_pricing',      count(*) FROM partner_pricing
UNION ALL SELECT 'partner_payouts',      count(*) FROM partner_payouts
UNION ALL SELECT 'subscriptions',        count(*) FROM subscriptions
UNION ALL SELECT 'billing_events',       count(*) FROM billing_events
UNION ALL SELECT 'default_pricing',      count(*) FROM default_pricing;

-- If counts look right (everything 0 except auth.users=1, platform_admins=1,
-- default_pricing>0), commit. Otherwise ROLLBACK.
COMMIT;
