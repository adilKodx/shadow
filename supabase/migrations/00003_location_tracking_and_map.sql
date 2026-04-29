-- ============================================================
-- ShadowField — Location Tracking & Map Features
-- ============================================================

-- ─── MEMBER LOCATIONS (real-time GPS from logged-in members) ───
CREATE TABLE IF NOT EXISTS member_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  latitude NUMERIC(10,7) NOT NULL,
  longitude NUMERIC(10,7) NOT NULL,
  accuracy NUMERIC(8,2),
  altitude NUMERIC(8,2),
  heading NUMERIC(5,1),
  speed NUMERIC(6,2),
  battery_level INT,
  is_moving BOOLEAN DEFAULT false,
  recorded_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_member_locations_tenant ON member_locations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_member_locations_user ON member_locations(user_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_member_locations_recent ON member_locations(tenant_id, recorded_at DESC);

-- ─── MAP ZONES (exit points, buildings, parking, etc.) ───
CREATE TABLE IF NOT EXISTS map_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  zone_type TEXT NOT NULL CHECK (zone_type IN ('exit','entrance','building','parking','restricted','safe_room','stage','nursery','playground','custom')) DEFAULT 'custom',
  description TEXT,
  color TEXT DEFAULT '#3B82F6',
  icon TEXT,
  -- polygon or circle
  shape_type TEXT CHECK (shape_type IN ('polygon','circle','marker')) DEFAULT 'marker',
  center_lat NUMERIC(10,7),
  center_lng NUMERIC(10,7),
  radius_meters NUMERIC(8,2),
  polygon_coords JSONB,
  -- floor / level
  floor_level INT DEFAULT 0,
  floor_name TEXT DEFAULT 'Ground',
  -- settings
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_map_zones_tenant ON map_zones(tenant_id);

-- ─── MAP OVERLAYS (uploaded floor plans / campus images) ───
CREATE TABLE IF NOT EXISTS map_overlays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  -- bounding box for positioning overlay on map
  north_lat NUMERIC(10,7),
  south_lat NUMERIC(10,7),
  east_lng NUMERIC(10,7),
  west_lng NUMERIC(10,7),
  opacity NUMERIC(3,2) DEFAULT 0.75,
  floor_level INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_map_overlays_tenant ON map_overlays(tenant_id);

-- ─── GEOFENCE EVENTS (enter/exit zone tracking) ───
CREATE TABLE IF NOT EXISTS geofence_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  zone_id UUID NOT NULL REFERENCES map_zones(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('enter','exit','dwell')),
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  duration_seconds INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_geofence_events_tenant ON geofence_events(tenant_id, created_at DESC);

-- ─── SECURITY PIN ───
ALTER TABLE tenant_members ADD COLUMN IF NOT EXISTS security_pin TEXT;
ALTER TABLE tenant_members ADD COLUMN IF NOT EXISTS pin_enabled BOOLEAN DEFAULT false;
ALTER TABLE tenant_members ADD COLUMN IF NOT EXISTS biometric_enabled BOOLEAN DEFAULT false;
ALTER TABLE tenant_members ADD COLUMN IF NOT EXISTS lock_timeout_minutes INT DEFAULT 5;

-- ─── RLS ───
ALTER TABLE member_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE map_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE map_overlays ENABLE ROW LEVEL SECURITY;
ALTER TABLE geofence_events ENABLE ROW LEVEL SECURITY;

-- member_locations: tenant scoped
DO $$ BEGIN
  CREATE POLICY "ml_select" ON member_locations FOR SELECT TO authenticated
    USING (tenant_id IN (SELECT get_my_tenant_ids()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "ml_insert" ON member_locations FOR INSERT TO authenticated
    WITH CHECK (tenant_id IN (SELECT get_my_tenant_ids()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "ml_delete" ON member_locations FOR DELETE TO authenticated
    USING (tenant_id IN (SELECT get_my_tenant_ids()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- map_zones: tenant scoped
DO $$ BEGIN
  CREATE POLICY "mz_select" ON map_zones FOR SELECT TO authenticated
    USING (tenant_id IN (SELECT get_my_tenant_ids()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "mz_insert" ON map_zones FOR INSERT TO authenticated
    WITH CHECK (tenant_id IN (SELECT get_my_tenant_ids()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "mz_update" ON map_zones FOR UPDATE TO authenticated
    USING (tenant_id IN (SELECT get_my_tenant_ids()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "mz_delete" ON map_zones FOR DELETE TO authenticated
    USING (tenant_id IN (SELECT get_my_tenant_ids()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- map_overlays: tenant scoped
DO $$ BEGIN
  CREATE POLICY "mo_select" ON map_overlays FOR SELECT TO authenticated
    USING (tenant_id IN (SELECT get_my_tenant_ids()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "mo_insert" ON map_overlays FOR INSERT TO authenticated
    WITH CHECK (tenant_id IN (SELECT get_my_tenant_ids()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "mo_update" ON map_overlays FOR UPDATE TO authenticated
    USING (tenant_id IN (SELECT get_my_tenant_ids()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "mo_delete" ON map_overlays FOR DELETE TO authenticated
    USING (tenant_id IN (SELECT get_my_tenant_ids()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- geofence_events: tenant scoped
DO $$ BEGIN
  CREATE POLICY "ge_select" ON geofence_events FOR SELECT TO authenticated
    USING (tenant_id IN (SELECT get_my_tenant_ids()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "ge_insert" ON geofence_events FOR INSERT TO authenticated
    WITH CHECK (tenant_id IN (SELECT get_my_tenant_ids()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Storage bucket for map overlays
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('map-overlays', 'map-overlays', true, 52428800)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "map_overlay_upload" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'map-overlays');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "map_overlay_read" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'map-overlays');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RPC: report location (SECURITY DEFINER for performance)
CREATE OR REPLACE FUNCTION report_member_location(
  p_tenant_id UUID,
  p_user_id UUID,
  p_display_name TEXT,
  p_latitude NUMERIC,
  p_longitude NUMERIC,
  p_accuracy NUMERIC DEFAULT NULL,
  p_altitude NUMERIC DEFAULT NULL,
  p_heading NUMERIC DEFAULT NULL,
  p_speed NUMERIC DEFAULT NULL,
  p_battery_level INT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO member_locations (tenant_id, user_id, display_name, latitude, longitude, accuracy, altitude, heading, speed, battery_level, is_moving)
  VALUES (p_tenant_id, p_user_id, p_display_name, p_latitude, p_longitude, p_accuracy, p_altitude, p_heading, p_speed, p_battery_level, COALESCE(p_speed, 0) > 0.5);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: get latest location per team member (deduped)
CREATE OR REPLACE FUNCTION get_team_locations(p_tenant_id UUID)
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  accuracy NUMERIC,
  heading NUMERIC,
  speed NUMERIC,
  battery_level INT,
  is_moving BOOLEAN,
  recorded_at TIMESTAMPTZ
) AS $$
  SELECT DISTINCT ON (ml.user_id)
    ml.user_id,
    ml.display_name,
    ml.latitude,
    ml.longitude,
    ml.accuracy,
    ml.heading,
    ml.speed,
    ml.battery_level,
    ml.is_moving,
    ml.recorded_at
  FROM member_locations ml
  WHERE ml.tenant_id = p_tenant_id
    AND ml.recorded_at > now() - interval '15 minutes'
  ORDER BY ml.user_id, ml.recorded_at DESC;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- RPC: set/verify security PIN
CREATE OR REPLACE FUNCTION set_security_pin(p_pin TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE tenant_members
  SET security_pin = crypt(p_pin, gen_salt('bf')),
      pin_enabled = true
  WHERE user_id = auth.uid() AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION verify_security_pin(p_pin TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_stored TEXT;
BEGIN
  SELECT security_pin INTO v_stored
  FROM tenant_members
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1;
  
  IF v_stored IS NULL THEN RETURN false; END IF;
  RETURN v_stored = crypt(p_pin, v_stored);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
