-- ============================================================
-- ShadowField - Initial Schema
-- Safety & Communication Platform for Security Teams
-- ============================================================

-- ─── TENANTS (Organizations) ───
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  -- white-label branding
  logo_url TEXT,
  primary_color TEXT DEFAULT '#1e40af',
  secondary_color TEXT DEFAULT '#0ea5e9',
  accent_color TEXT DEFAULT '#f59e0b',
  app_name TEXT DEFAULT 'ShadowField',
  tagline TEXT DEFAULT 'Safety & Communication Platform',
  favicon_url TEXT,
  login_bg_url TEXT,
  custom_domain TEXT,
  -- settings
  max_members INT DEFAULT 50,
  features_enabled JSONB DEFAULT '{"chat":true,"video_feeds":true,"poi":true,"incidents":true,"alerts":true,"news":true,"ai_evaluation":true}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  trial_ends_at TIMESTAMPTZ,
  subscription_tier TEXT CHECK (subscription_tier IN ('free','starter','professional','enterprise')) DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── TENANT MEMBERS ───
CREATE TABLE tenant_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL CHECK (role IN ('owner','admin','supervisor','member','viewer')) DEFAULT 'member',
  title TEXT,
  badge_number TEXT,
  is_active BOOLEAN DEFAULT true,
  last_seen_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

-- ─── INVITE CODES ───
CREATE TABLE tenant_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(6), 'hex'),
  role TEXT NOT NULL CHECK (role IN ('admin','supervisor','member','viewer')) DEFAULT 'member',
  max_uses INT DEFAULT 1,
  used_count INT DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── CHAT CHANNELS ───
CREATE TABLE chat_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  channel_type TEXT NOT NULL CHECK (channel_type IN ('general','team','direct','alert','command')) DEFAULT 'general',
  is_private BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── CHAT CHANNEL MEMBERS ───
CREATE TABLE chat_channel_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin','member')),
  last_read_at TIMESTAMPTZ DEFAULT now(),
  is_muted BOOLEAN DEFAULT false,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

-- ─── CHAT MESSAGES ───
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  sender_name TEXT NOT NULL,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text','image','file','alert','system','location')),
  file_url TEXT,
  file_name TEXT,
  file_type TEXT,
  metadata JSONB,
  is_pinned BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── NEWS / ANNOUNCEMENTS ───
CREATE TABLE news_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  cover_image_url TEXT,
  category TEXT CHECK (category IN ('announcement','update','policy','training','safety','event','general')) DEFAULT 'general',
  priority TEXT CHECK (priority IN ('normal','important','urgent')) DEFAULT 'normal',
  is_pinned BOOLEAN DEFAULT false,
  is_published BOOLEAN DEFAULT true,
  publish_at TIMESTAMPTZ DEFAULT now(),
  author_id UUID REFERENCES auth.users(id),
  author_name TEXT,
  view_count INT DEFAULT 0,
  -- broadcast to all tenants (company-level)
  is_global BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── NEWS ATTACHMENTS ───
CREATE TABLE news_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  news_id UUID NOT NULL REFERENCES news_posts(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── PERSONS OF INTEREST (POI) ───
CREATE TABLE poi_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- person info
  first_name TEXT,
  last_name TEXT,
  alias TEXT,
  description TEXT,
  date_of_birth DATE,
  gender TEXT,
  height TEXT,
  weight TEXT,
  hair_color TEXT,
  eye_color TEXT,
  distinguishing_marks TEXT,
  -- classification
  threat_level TEXT NOT NULL CHECK (threat_level IN ('low','medium','high','critical')) DEFAULT 'medium',
  status TEXT NOT NULL CHECK (status IN ('active','inactive','resolved','banned','watch')) DEFAULT 'active',
  category TEXT CHECK (category IN ('trespass','theft','assault','harassment','suspicious','banned','known_offender','missing','other')) DEFAULT 'suspicious',
  -- contact / known info
  known_address TEXT,
  known_vehicle TEXT,
  known_associates TEXT,
  -- AI assessment
  ai_risk_score NUMERIC(3,1),
  ai_assessment TEXT,
  ai_assessed_at TIMESTAMPTZ,
  -- metadata
  reported_by UUID REFERENCES auth.users(id),
  reported_by_name TEXT,
  last_seen_at TIMESTAMPTZ,
  last_seen_location TEXT,
  notes TEXT,
  tags TEXT[],
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── POI PHOTOS ───
CREATE TABLE poi_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poi_id UUID NOT NULL REFERENCES poi_records(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  is_primary BOOLEAN DEFAULT false,
  caption TEXT,
  taken_at TIMESTAMPTZ,
  sort_order INT DEFAULT 0,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── POI SIGHTINGS ───
CREATE TABLE poi_sightings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poi_id UUID NOT NULL REFERENCES poi_records(id) ON DELETE CASCADE,
  reported_by UUID REFERENCES auth.users(id),
  reported_by_name TEXT,
  location TEXT,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  description TEXT,
  photo_url TEXT,
  sighted_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── INCIDENTS ───
CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  incident_number TEXT UNIQUE,
  -- classification
  title TEXT NOT NULL,
  description TEXT,
  incident_type TEXT NOT NULL CHECK (incident_type IN (
    'security_breach','theft','assault','trespass','vandalism','medical',
    'fire','suspicious_activity','disturbance','vehicle','weather',
    'evacuation','lockdown','equipment_failure','policy_violation','other'
  )) DEFAULT 'other',
  severity TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')) DEFAULT 'medium',
  status TEXT NOT NULL CHECK (status IN ('reported','investigating','contained','resolved','closed','escalated')) DEFAULT 'reported',
  priority TEXT CHECK (priority IN ('low','normal','high','urgent')) DEFAULT 'normal',
  -- location
  location TEXT,
  location_detail TEXT,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  -- time
  occurred_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  -- people
  reported_by UUID REFERENCES auth.users(id),
  reported_by_name TEXT,
  assigned_to UUID REFERENCES auth.users(id),
  assigned_to_name TEXT,
  -- linked
  poi_id UUID REFERENCES poi_records(id),
  -- details
  injuries_reported BOOLEAN DEFAULT false,
  police_notified BOOLEAN DEFAULT false,
  police_report_number TEXT,
  evidence_collected TEXT,
  witness_info TEXT,
  resolution_notes TEXT,
  -- AI
  ai_severity_score NUMERIC(3,1),
  ai_analysis TEXT,
  ai_recommendations TEXT,
  ai_analyzed_at TIMESTAMPTZ,
  -- meta
  tags TEXT[],
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- auto-generate incident numbers
CREATE OR REPLACE FUNCTION generate_incident_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.incident_number := 'INC-' || LPAD(nextval('incident_number_seq')::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS incident_number_seq START 1;
CREATE TRIGGER trg_incident_number
  BEFORE INSERT ON incidents
  FOR EACH ROW
  WHEN (NEW.incident_number IS NULL)
  EXECUTE FUNCTION generate_incident_number();

-- ─── INCIDENT PHOTOS ───
CREATE TABLE incident_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  caption TEXT,
  sort_order INT DEFAULT 0,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── INCIDENT UPDATES / TIMELINE ───
CREATE TABLE incident_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id),
  author_name TEXT,
  content TEXT NOT NULL,
  update_type TEXT DEFAULT 'note' CHECK (update_type IN ('note','status_change','assignment','escalation','resolution','system')),
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── ALERTS ───
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('emergency','warning','info','all_clear','lockdown','evacuation','bolo','weather','medical','custom')) DEFAULT 'info',
  priority TEXT NOT NULL CHECK (priority IN ('low','normal','high','critical')) DEFAULT 'normal',
  -- targeting
  target_all BOOLEAN DEFAULT true,
  target_roles TEXT[],
  -- media
  image_url TEXT,
  -- status
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  acknowledged_count INT DEFAULT 0,
  -- sender
  created_by UUID REFERENCES auth.users(id),
  created_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── ALERT ACKNOWLEDGMENTS ───
CREATE TABLE alert_acknowledgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  user_name TEXT,
  acknowledged_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(alert_id, user_id)
);

-- ─── VIDEO FEEDS ───
CREATE TABLE video_feeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  feed_url TEXT NOT NULL,
  feed_type TEXT NOT NULL CHECK (feed_type IN ('rtsp','hls','mjpeg','embed','youtube','ip_camera')) DEFAULT 'embed',
  location TEXT,
  -- status
  is_active BOOLEAN DEFAULT true,
  is_recording BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'online' CHECK (status IN ('online','offline','maintenance','error')),
  -- layout
  grid_position INT,
  thumbnail_url TEXT,
  -- meta
  camera_model TEXT,
  resolution TEXT,
  notes TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── ACTIVITY LOG ───
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  user_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  description TEXT,
  metadata JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── STORAGE BUCKETS ───
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES
  ('poi-photos', 'poi-photos', true, 52428800),
  ('incident-photos', 'incident-photos', true, 52428800),
  ('news-attachments', 'news-attachments', true, 52428800),
  ('chat-files', 'chat-files', true, 52428800),
  ('tenant-branding', 'tenant-branding', true, 10485760)
ON CONFLICT (id) DO NOTHING;

-- ─── STORAGE POLICIES ───
CREATE POLICY "Authenticated users can upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('poi-photos','incident-photos','news-attachments','chat-files','tenant-branding'));

CREATE POLICY "Authenticated users can read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id IN ('poi-photos','incident-photos','news-attachments','chat-files','tenant-branding'));

CREATE POLICY "Authenticated users can delete own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id IN ('poi-photos','incident-photos','news-attachments','chat-files','tenant-branding'));

-- ─── RLS POLICIES ───
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE poi_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE poi_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE poi_sightings ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_acknowledgments ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Helper: get tenant IDs for current user
CREATE OR REPLACE FUNCTION get_my_tenant_ids()
RETURNS SETOF UUID AS $$
  SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND is_active = true;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Macro: generate standard RLS policies for a tenant-scoped table
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'chat_channels','news_posts','poi_records',
    'incidents','alerts','video_feeds','activity_log'
  ] LOOP
    EXECUTE format('CREATE POLICY "tenant_select_%s" ON %I FOR SELECT TO authenticated USING (tenant_id IN (SELECT get_my_tenant_ids()))', tbl, tbl);
    EXECUTE format('CREATE POLICY "tenant_insert_%s" ON %I FOR INSERT TO authenticated WITH CHECK (tenant_id IN (SELECT get_my_tenant_ids()))', tbl, tbl);
    EXECUTE format('CREATE POLICY "tenant_update_%s" ON %I FOR UPDATE TO authenticated USING (tenant_id IN (SELECT get_my_tenant_ids()))', tbl, tbl);
    EXECUTE format('CREATE POLICY "tenant_delete_%s" ON %I FOR DELETE TO authenticated USING (tenant_id IN (SELECT get_my_tenant_ids()))', tbl, tbl);
  END LOOP;
END $$;

-- Tenant members: users can see members of their tenants
CREATE POLICY "tm_select" ON tenant_members FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT get_my_tenant_ids()));
CREATE POLICY "tm_insert" ON tenant_members FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "tm_update" ON tenant_members FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT get_my_tenant_ids()));
CREATE POLICY "tm_delete" ON tenant_members FOR DELETE TO authenticated
  USING (tenant_id IN (SELECT get_my_tenant_ids()));

-- Tenants: members can see their tenant
CREATE POLICY "t_select" ON tenants FOR SELECT TO authenticated
  USING (id IN (SELECT get_my_tenant_ids()));
CREATE POLICY "t_insert" ON tenants FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "t_update" ON tenants FOR UPDATE TO authenticated
  USING (id IN (SELECT get_my_tenant_ids()));

-- Invites: members can see their tenant's invites
CREATE POLICY "inv_select" ON tenant_invites FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT get_my_tenant_ids()));
CREATE POLICY "inv_insert" ON tenant_invites FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT get_my_tenant_ids()));
CREATE POLICY "inv_update" ON tenant_invites FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT get_my_tenant_ids()));
CREATE POLICY "inv_delete" ON tenant_invites FOR DELETE TO authenticated
  USING (tenant_id IN (SELECT get_my_tenant_ids()));

-- ─── Child table RLS (join through parent FK) ───

-- news_attachments via news_posts
CREATE POLICY "na_select" ON news_attachments FOR SELECT TO authenticated
  USING (news_id IN (SELECT id FROM news_posts WHERE tenant_id IN (SELECT get_my_tenant_ids())));
CREATE POLICY "na_insert" ON news_attachments FOR INSERT TO authenticated
  WITH CHECK (news_id IN (SELECT id FROM news_posts WHERE tenant_id IN (SELECT get_my_tenant_ids())));
CREATE POLICY "na_update" ON news_attachments FOR UPDATE TO authenticated
  USING (news_id IN (SELECT id FROM news_posts WHERE tenant_id IN (SELECT get_my_tenant_ids())));
CREATE POLICY "na_delete" ON news_attachments FOR DELETE TO authenticated
  USING (news_id IN (SELECT id FROM news_posts WHERE tenant_id IN (SELECT get_my_tenant_ids())));

-- poi_photos via poi_records
CREATE POLICY "pp_select" ON poi_photos FOR SELECT TO authenticated
  USING (poi_id IN (SELECT id FROM poi_records WHERE tenant_id IN (SELECT get_my_tenant_ids())));
CREATE POLICY "pp_insert" ON poi_photos FOR INSERT TO authenticated
  WITH CHECK (poi_id IN (SELECT id FROM poi_records WHERE tenant_id IN (SELECT get_my_tenant_ids())));
CREATE POLICY "pp_update" ON poi_photos FOR UPDATE TO authenticated
  USING (poi_id IN (SELECT id FROM poi_records WHERE tenant_id IN (SELECT get_my_tenant_ids())));
CREATE POLICY "pp_delete" ON poi_photos FOR DELETE TO authenticated
  USING (poi_id IN (SELECT id FROM poi_records WHERE tenant_id IN (SELECT get_my_tenant_ids())));

-- poi_sightings via poi_records
CREATE POLICY "ps_select" ON poi_sightings FOR SELECT TO authenticated
  USING (poi_id IN (SELECT id FROM poi_records WHERE tenant_id IN (SELECT get_my_tenant_ids())));
CREATE POLICY "ps_insert" ON poi_sightings FOR INSERT TO authenticated
  WITH CHECK (poi_id IN (SELECT id FROM poi_records WHERE tenant_id IN (SELECT get_my_tenant_ids())));
CREATE POLICY "ps_update" ON poi_sightings FOR UPDATE TO authenticated
  USING (poi_id IN (SELECT id FROM poi_records WHERE tenant_id IN (SELECT get_my_tenant_ids())));
CREATE POLICY "ps_delete" ON poi_sightings FOR DELETE TO authenticated
  USING (poi_id IN (SELECT id FROM poi_records WHERE tenant_id IN (SELECT get_my_tenant_ids())));

-- incident_photos via incidents
CREATE POLICY "ip_select" ON incident_photos FOR SELECT TO authenticated
  USING (incident_id IN (SELECT id FROM incidents WHERE tenant_id IN (SELECT get_my_tenant_ids())));
CREATE POLICY "ip_insert" ON incident_photos FOR INSERT TO authenticated
  WITH CHECK (incident_id IN (SELECT id FROM incidents WHERE tenant_id IN (SELECT get_my_tenant_ids())));
CREATE POLICY "ip_update" ON incident_photos FOR UPDATE TO authenticated
  USING (incident_id IN (SELECT id FROM incidents WHERE tenant_id IN (SELECT get_my_tenant_ids())));
CREATE POLICY "ip_delete" ON incident_photos FOR DELETE TO authenticated
  USING (incident_id IN (SELECT id FROM incidents WHERE tenant_id IN (SELECT get_my_tenant_ids())));

-- incident_updates via incidents
CREATE POLICY "iu_select" ON incident_updates FOR SELECT TO authenticated
  USING (incident_id IN (SELECT id FROM incidents WHERE tenant_id IN (SELECT get_my_tenant_ids())));
CREATE POLICY "iu_insert" ON incident_updates FOR INSERT TO authenticated
  WITH CHECK (incident_id IN (SELECT id FROM incidents WHERE tenant_id IN (SELECT get_my_tenant_ids())));
CREATE POLICY "iu_update" ON incident_updates FOR UPDATE TO authenticated
  USING (incident_id IN (SELECT id FROM incidents WHERE tenant_id IN (SELECT get_my_tenant_ids())));
CREATE POLICY "iu_delete" ON incident_updates FOR DELETE TO authenticated
  USING (incident_id IN (SELECT id FROM incidents WHERE tenant_id IN (SELECT get_my_tenant_ids())));

-- alert_acknowledgments via alerts
CREATE POLICY "aa_select" ON alert_acknowledgments FOR SELECT TO authenticated
  USING (alert_id IN (SELECT id FROM alerts WHERE tenant_id IN (SELECT get_my_tenant_ids())));
CREATE POLICY "aa_insert" ON alert_acknowledgments FOR INSERT TO authenticated
  WITH CHECK (alert_id IN (SELECT id FROM alerts WHERE tenant_id IN (SELECT get_my_tenant_ids())));
CREATE POLICY "aa_delete" ON alert_acknowledgments FOR DELETE TO authenticated
  USING (alert_id IN (SELECT id FROM alerts WHERE tenant_id IN (SELECT get_my_tenant_ids())));

-- Chat channel members & messages: via channel membership
CREATE POLICY "ccm_select" ON chat_channel_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR channel_id IN (
    SELECT cm.channel_id FROM chat_channel_members cm WHERE cm.user_id = auth.uid()
  ));
CREATE POLICY "ccm_insert" ON chat_channel_members FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "ccm_delete" ON chat_channel_members FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "msg_select" ON chat_messages FOR SELECT TO authenticated
  USING (channel_id IN (
    SELECT cm.channel_id FROM chat_channel_members cm WHERE cm.user_id = auth.uid()
  ));
CREATE POLICY "msg_insert" ON chat_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

-- ─── INDEXES ───
CREATE INDEX idx_tenant_members_tenant ON tenant_members(tenant_id);
CREATE INDEX idx_tenant_members_user ON tenant_members(user_id);
CREATE INDEX idx_chat_channels_tenant ON chat_channels(tenant_id);
CREATE INDEX idx_chat_messages_channel ON chat_messages(channel_id);
CREATE INDEX idx_chat_messages_created ON chat_messages(created_at DESC);
CREATE INDEX idx_news_posts_tenant ON news_posts(tenant_id);
CREATE INDEX idx_news_posts_published ON news_posts(publish_at DESC);
CREATE INDEX idx_poi_records_tenant ON poi_records(tenant_id);
CREATE INDEX idx_poi_records_threat ON poi_records(threat_level);
CREATE INDEX idx_incidents_tenant ON incidents(tenant_id);
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_incidents_occurred ON incidents(occurred_at DESC);
CREATE INDEX idx_alerts_tenant ON alerts(tenant_id);
CREATE INDEX idx_alerts_active ON alerts(is_active, created_at DESC);
CREATE INDEX idx_video_feeds_tenant ON video_feeds(tenant_id);
CREATE INDEX idx_activity_log_tenant ON activity_log(tenant_id, created_at DESC);
