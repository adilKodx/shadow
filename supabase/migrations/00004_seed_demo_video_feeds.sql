-- ============================================================
-- ShadowField — Seed demo video feeds per tenant
-- These are public embeddable streams for demo/testing.
-- Runs as a function so each new tenant gets feeds automatically.
-- ============================================================

CREATE OR REPLACE FUNCTION seed_demo_video_feeds(p_tenant_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO video_feeds (tenant_id, name, feed_url, feed_type, location, status, is_active, grid_position) VALUES
    -- Public live traffic / city cams (embed type)
    (p_tenant_id, 'Front Entrance', 'https://www.youtube.com/embed/ydYDqZQpim8?autoplay=1&mute=1', 'youtube', 'Main Lobby', 'online', true, 1),
    (p_tenant_id, 'Parking Lot A', 'https://www.youtube.com/embed/1EiC9bvVGnk?autoplay=1&mute=1', 'youtube', 'North Parking', 'online', true, 2),
    (p_tenant_id, 'Sanctuary Interior', 'https://www.youtube.com/embed/aqz-KE-bpKQ?autoplay=1&mute=1', 'youtube', 'Main Hall', 'online', true, 3),
    (p_tenant_id, 'Children''s Wing', 'https://www.youtube.com/embed/bUJhEo_gPfE?autoplay=1&mute=1', 'youtube', 'East Building', 'online', true, 4),
    (p_tenant_id, 'Rear Exit', 'https://www.youtube.com/embed/YLkEWEmd2QI?autoplay=1&mute=1', 'youtube', 'Back Door', 'online', true, 5),
    (p_tenant_id, 'Fellowship Hall', 'https://www.youtube.com/embed/sFHzqJSg79M?autoplay=1&mute=1', 'youtube', 'Community Center', 'online', true, 6);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also update the signup RPC to seed feeds for new tenants
-- (Add to create_tenant_and_owner if desired)
