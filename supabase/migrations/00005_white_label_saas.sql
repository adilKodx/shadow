-- ============================================================
-- ShadowField — White-Label SaaS, Billing & Terms
-- ============================================================

-- ─── WHITE-LABEL PARTNERS (resellers like Sheperly) ───
CREATE TABLE white_label_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- identity
  slug TEXT NOT NULL UNIQUE,                          -- e.g. 'sheperly' → /signup/sheperly
  company_name TEXT NOT NULL,                          -- "Sheperly"
  tagline TEXT DEFAULT 'Church Security Platform',
  -- branding
  logo_url TEXT,
  favicon_url TEXT,
  primary_color TEXT DEFAULT '#1E40AF',
  secondary_color TEXT DEFAULT '#0EA5E9',
  accent_color TEXT DEFAULT '#F59E0B',
  hero_image_url TEXT,
  -- contact
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  website_url TEXT,
  -- commission
  commission_pct NUMERIC(5,2) NOT NULL DEFAULT 15.00,  -- % of fees → partner
  commission_type TEXT DEFAULT 'recurring' CHECK (commission_type IN ('recurring','one_time','first_year')),
  -- marketing page content
  hero_headline TEXT DEFAULT 'Protect Your Congregation',
  hero_subheadline TEXT DEFAULT 'Professional security operations platform built for houses of worship',
  features_json JSONB DEFAULT '[]'::JSONB,             -- custom feature list
  testimonials_json JSONB DEFAULT '[]'::JSONB,         -- custom testimonials
  faq_json JSONB DEFAULT '[]'::JSONB,                  -- custom FAQ
  -- custom T&C
  terms_override TEXT,                                  -- if null, use ShadowField default
  privacy_override TEXT,
  -- status
  is_active BOOLEAN DEFAULT true,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  -- meta
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_wlp_slug ON white_label_partners(slug);

-- ─── PARTNER PRICING OVERRIDES ───
-- If a partner row exists for a tier, use that price. Otherwise use default.
CREATE TABLE partner_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES white_label_partners(id) ON DELETE CASCADE,
  tier_key TEXT NOT NULL CHECK (tier_key IN ('starter','professional','ministry','enterprise')),
  -- monthly prices
  monthly_price NUMERIC(10,2) NOT NULL,
  -- annual = monthly × 12 × (1 - annual_discount_pct/100)
  annual_discount_pct NUMERIC(5,2) DEFAULT 20.00,
  -- limits
  max_members INT NOT NULL,
  -- extras
  features_json JSONB DEFAULT '[]'::JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(partner_id, tier_key)
);

-- ─── DEFAULT PRICING (ShadowField direct) ───
CREATE TABLE default_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_key TEXT NOT NULL UNIQUE CHECK (tier_key IN ('starter','professional','ministry','enterprise')),
  tier_name TEXT NOT NULL,
  monthly_price NUMERIC(10,2) NOT NULL,
  annual_discount_pct NUMERIC(5,2) DEFAULT 20.00,
  max_members INT NOT NULL,
  description TEXT,
  features_json JSONB DEFAULT '[]'::JSONB,
  is_popular BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default tiers
INSERT INTO default_pricing (tier_key, tier_name, monthly_price, max_members, description, features_json, is_popular, sort_order) VALUES
  ('starter', 'Starter', 25.00, 3, 'Perfect for small churches with a lean security team',
    '["Up to 3 security members","Team chat & alerts","Incident reporting","Basic video feeds","Email support"]'::JSONB, false, 1),
  ('professional', 'Professional', 50.00, 8, 'For growing congregations that need more coverage',
    '["Up to 8 security members","Everything in Starter","Live Map & GPS tracking","Persons of Interest database","SOPs & Action Plans","Priority support"]'::JSONB, true, 2),
  ('ministry', 'Ministry', 150.00, 15, 'Full-featured platform for large ministry campuses',
    '["Up to 15 security members","Everything in Professional","Multi-campus support","Advanced analytics","Custom branding","Phone & email support"]'::JSONB, false, 3),
  ('enterprise', 'Enterprise', 0.00, 999, 'For mega-churches and multi-site organizations',
    '["Unlimited security members","Everything in Ministry","Dedicated account manager","Custom integrations","SLA guarantee","On-site training"]'::JSONB, false, 4);

-- ─── SUBSCRIPTIONS ───
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- plan
  tier_key TEXT NOT NULL CHECK (tier_key IN ('starter','professional','ministry','enterprise')),
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly','annual')) DEFAULT 'monthly',
  -- pricing at time of subscription
  base_price NUMERIC(10,2) NOT NULL,                -- monthly or annual price locked in
  discount_pct NUMERIC(5,2) DEFAULT 0,
  effective_price NUMERIC(10,2) NOT NULL,            -- after discount
  -- partner attribution
  partner_id UUID REFERENCES white_label_partners(id),
  partner_commission_pct NUMERIC(5,2) DEFAULT 0,
  -- status
  status TEXT NOT NULL CHECK (status IN ('trialing','active','past_due','canceled','paused','expired')) DEFAULT 'trialing',
  -- dates
  trial_ends_at TIMESTAMPTZ DEFAULT now() + interval '14 days',
  current_period_start TIMESTAMPTZ DEFAULT now(),
  current_period_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  -- payment
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  payment_method_last4 TEXT,
  payment_method_brand TEXT,
  -- meta
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX idx_subscriptions_partner ON subscriptions(partner_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- ─── BILLING EVENTS / INVOICES ───
CREATE TABLE billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- event
  event_type TEXT NOT NULL CHECK (event_type IN (
    'invoice_created','payment_succeeded','payment_failed',
    'subscription_created','subscription_updated','subscription_canceled',
    'trial_started','trial_ending','trial_ended',
    'refund','credit','commission_paid'
  )),
  -- money
  amount NUMERIC(10,2),
  currency TEXT DEFAULT 'usd',
  -- commission
  partner_id UUID REFERENCES white_label_partners(id),
  commission_amount NUMERIC(10,2),
  commission_paid BOOLEAN DEFAULT false,
  commission_paid_at TIMESTAMPTZ,
  -- stripe
  stripe_invoice_id TEXT,
  stripe_payment_intent_id TEXT,
  -- details
  description TEXT,
  metadata JSONB,
  -- period
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  -- meta
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_billing_tenant ON billing_events(tenant_id, created_at DESC);
CREATE INDEX idx_billing_partner ON billing_events(partner_id, created_at DESC);

-- ─── TERMS & CONDITIONS ───
CREATE TABLE terms_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL UNIQUE,                      -- e.g. '2026.04.1'
  title TEXT NOT NULL DEFAULT 'Terms of Service',
  content TEXT NOT NULL,                              -- full T&C text (markdown)
  privacy_content TEXT,                               -- privacy policy
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure only one current version
CREATE UNIQUE INDEX idx_terms_current ON terms_versions(is_current) WHERE is_current = true;

CREATE TABLE terms_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_version_id UUID NOT NULL REFERENCES terms_versions(id),
  tenant_id UUID REFERENCES tenants(id),
  -- acceptance details
  accepted_at TIMESTAMPTZ DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  -- what they agreed to
  agreed_to_terms BOOLEAN NOT NULL DEFAULT true,
  agreed_to_privacy BOOLEAN NOT NULL DEFAULT true,
  agreed_to_data_ownership BOOLEAN NOT NULL DEFAULT true,
  -- the key clause: ShadowField owns the account
  agreed_to_platform_ownership BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(user_id, terms_version_id)
);

CREATE INDEX idx_terms_user ON terms_acceptances(user_id, accepted_at DESC);

-- Seed initial terms version
INSERT INTO terms_versions (version, title, content, privacy_content, effective_date, is_current) VALUES (
  '2026.04.1',
  'ShadowField Terms of Service',
  E'# ShadowField Terms of Service\n\n**Effective Date: April 4, 2026**\n\n## 1. Platform Ownership\n\nShadowField ("the Platform") is owned and operated by ShadowField Inc. All accounts, data, and customer relationships created through the Platform are the property of ShadowField Inc., regardless of the reseller, partner, or white-label provider through which you accessed the service.\n\n## 2. White-Label Partners\n\nYou may have accessed this platform through a ShadowField authorized partner. While partners provide administrative support and management services, ShadowField Inc. retains full ownership of:\n- Your account and login credentials\n- All data entered into the platform\n- Customer relationships and communications\n- Billing and payment processing\n\n## 3. Data Ownership & Privacy\n\nAll organizational data, incident reports, video feeds, and communications stored on the Platform remain the property of ShadowField Inc. You are granted a license to access and use your data while your subscription is active.\n\n## 4. Subscription & Billing\n\n- Subscriptions are billed monthly or annually as selected during signup\n- Annual plans receive a discount as advertised at time of purchase\n- Failed payments will result in a 7-day grace period before service suspension\n- Canceled accounts retain read-only access for 30 days\n\n## 5. Acceptable Use\n\nThe Platform is designed for legitimate church and house of worship security operations. You agree not to use the platform for surveillance of individuals without their knowledge or consent beyond security purposes.\n\n## 6. Limitation of Liability\n\nShadowField Inc. provides a communication and coordination tool. We are not a security company and do not guarantee the prevention of security incidents. Users are responsible for their own security decisions and actions.\n\nBy using ShadowField, you acknowledge and agree to all terms above.',
  E'# ShadowField Privacy Policy\n\n**Effective Date: April 4, 2026**\n\n## Data We Collect\n- Account information (name, email, organization)\n- Location data (when GPS tracking is enabled)\n- Incident reports and communications\n- Video feed URLs (not the video content itself)\n- Usage analytics\n\n## How We Use Data\n- To provide and improve the Platform\n- To process billing and subscriptions\n- To communicate service updates\n- To comply with legal requirements\n\n## Data Sharing\n- We do not sell your data\n- White-label partners have limited administrative access\n- Law enforcement requests are handled per applicable law\n\n## Data Retention\n- Active accounts: data retained while subscription active\n- Canceled accounts: data retained 90 days then deleted\n- Billing records: retained 7 years per tax requirements',
  '2026-04-04',
  true
);

-- ─── ADD PARTNER REFERENCE TO TENANTS ───
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES white_label_partners(id);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'starter';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS billing_cycle TEXT DEFAULT 'monthly';

-- ─── RLS ───
ALTER TABLE white_label_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE default_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE terms_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE terms_acceptances ENABLE ROW LEVEL SECURITY;

-- Public read for partners (needed for signup pages)
CREATE POLICY "wlp_public_read" ON white_label_partners FOR SELECT TO anon, authenticated
  USING (is_active = true);

-- Public read for pricing
CREATE POLICY "dp_public_read" ON default_pricing FOR SELECT TO anon, authenticated
  USING (is_active = true);
CREATE POLICY "pp_public_read" ON partner_pricing FOR SELECT TO anon, authenticated
  USING (is_active = true);

-- Terms: public read
CREATE POLICY "tv_public_read" ON terms_versions FOR SELECT TO anon, authenticated
  USING (true);

-- Terms acceptances: user can read/write own
CREATE POLICY "ta_select_own" ON terms_acceptances FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "ta_insert_own" ON terms_acceptances FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Subscriptions: tenant-scoped
CREATE POLICY "sub_select" ON subscriptions FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT get_my_tenant_ids()));
CREATE POLICY "sub_update" ON subscriptions FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT get_my_tenant_ids()));

-- Billing: tenant-scoped
CREATE POLICY "be_select" ON billing_events FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT get_my_tenant_ids()));

-- ─── UPDATE SIGNUP RPC TO SUPPORT PARTNER ATTRIBUTION ───
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

  INSERT INTO chat_channel_members (channel_id, user_id, display_name)
  VALUES (v_channel_id, p_user_id, p_display_name);

  RETURN json_build_object('tenant_id', v_tenant_id, 'partner_id', v_partner_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── SEED SHEPERLY AS FIRST WHITE-LABEL PARTNER ───
INSERT INTO white_label_partners (
  slug, company_name, tagline, primary_color, secondary_color, accent_color,
  commission_pct, commission_type,
  hero_headline, hero_subheadline,
  contact_name, contact_email,
  features_json, testimonials_json, faq_json,
  is_active, approved_at
) VALUES (
  'sheperly',
  'Sheperly',
  'Shepherd Your Flock with Confidence',
  '#4F46E5', '#7C3AED', '#F59E0B',
  15.00, 'recurring',
  'Shepherd Your Flock Securely',
  'Professional church security managed by Sheperly, powered by industry-leading ShadowField technology',
  NULL, NULL,
  '[
    {"icon":"Shield","title":"24/7 Security Coordination","desc":"Real-time team communication, GPS tracking, and instant alerts keep your entire security team connected"},
    {"icon":"Camera","title":"Video Surveillance Hub","desc":"Monitor all your camera feeds from one dashboard. Supports IP cameras, YouTube streams, and more"},
    {"icon":"Map","title":"Live Campus Map","desc":"Track your security team in real-time, mark exits, entrances, and critical zones on an interactive map"},
    {"icon":"AlertTriangle","title":"Incident Management","desc":"Log, track, and resolve security incidents with full photo evidence and timeline tracking"},
    {"icon":"Users","title":"Team Management","desc":"Manage roles, schedules, and communications for your entire volunteer security team"},
    {"icon":"FileText","title":"SOPs & Action Plans","desc":"Store, edit, and run step-by-step emergency procedures so your team always knows what to do"}
  ]'::JSONB,
  '[
    {"name":"Pastor Michael Torres","role":"Senior Pastor, Grace Community Church","quote":"Sheperly transformed how we handle security. Our volunteer team went from uncertain to confident overnight.","rating":5},
    {"name":"David Chen","role":"Security Director, Harvest Chapel","quote":"The live map and instant alerts give me peace of mind every Sunday. Worth every penny.","rating":5},
    {"name":"Sarah Williams","role":"Operations Manager, New Hope Fellowship","quote":"We went from paper checklists to a professional security operation. The SOP runner is a game-changer.","rating":5}
  ]'::JSONB,
  '[
    {"q":"Who owns our data?","a":"All accounts and data are securely managed by ShadowField Inc., the technology platform behind Sheperly. Sheperly provides onboarding, training, and ongoing administrative support."},
    {"q":"What does Sheperly provide vs. ShadowField?","a":"ShadowField provides the technology platform, hosting, and data management. Sheperly provides personalized setup, training, and ongoing account management for your church."},
    {"q":"Can we switch from Sheperly to direct ShadowField?","a":"Yes. Since ShadowField owns all accounts, you can transition to direct ShadowField management at any time with no data loss."},
    {"q":"How does billing work?","a":"You are billed directly by ShadowField. Choose monthly or annual billing (save 20% annually). All payments are processed securely via Stripe."},
    {"q":"Is there a free trial?","a":"Yes! Every plan starts with a free 14-day trial. No credit card required to start."},
    {"q":"How many security team members can we have?","a":"Depends on your plan: Starter (3), Professional (8), Ministry (15), or Enterprise (unlimited). Contact us for custom needs."}
  ]'::JSONB,
  true, now()
);

-- Sheperly custom pricing (same as default for now, partner can adjust)
INSERT INTO partner_pricing (partner_id, tier_key, monthly_price, annual_discount_pct, max_members, is_active)
SELECT wlp.id, dp.tier_key, dp.monthly_price, dp.annual_discount_pct, dp.max_members, true
FROM white_label_partners wlp
CROSS JOIN default_pricing dp
WHERE wlp.slug = 'sheperly' AND dp.tier_key != 'enterprise';
