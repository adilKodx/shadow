-- ============================================================
-- Add home location (church building) to tenants
-- Used as default map center and zoom target
-- ============================================================

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS home_lat DOUBLE PRECISION;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS home_lng DOUBLE PRECISION;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS home_zoom INT DEFAULT 18;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS home_address TEXT;
