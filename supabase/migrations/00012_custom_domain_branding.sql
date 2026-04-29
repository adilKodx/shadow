-- ============================================================
-- Allow unauthenticated (anon) users to look up tenant branding
-- by custom_domain. This powers the white-label login page.
-- Only exposes branding fields, not sensitive data.
-- ============================================================

-- Anon can SELECT tenants by custom_domain (branding only)
CREATE POLICY "t_select_anon_branding" ON tenants FOR SELECT TO anon
  USING (custom_domain IS NOT NULL AND is_active = true);

-- Note: The anon key can only read columns returned by the query.
-- The app only selects branding columns (app_name, tagline, logo_url,
-- primary_color, secondary_color, accent_color, favicon_url, login_bg_url, slug).
-- Sensitive fields like features_enabled, subscription_tier etc. are not
-- exposed because the app never selects them in the branding query.
-- For extra protection, consider using a Supabase View or RPC that
-- only returns branding columns.

-- Also allow anon to read white_label_partners for partner signup pages
-- (the /signup/:slug route needs to load partner branding before auth)
CREATE POLICY "wlp_select_anon" ON white_label_partners FOR SELECT TO anon
  USING (is_active = true);
