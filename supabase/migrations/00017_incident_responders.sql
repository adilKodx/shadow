-- ============================================================
-- Phase 2 — Incident Response on Map
-- Adds multi-responder tracking: many staff can self-assign
-- to a single incident from the live map.
-- ============================================================

CREATE TABLE IF NOT EXISTS incident_responders (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id  UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  status       TEXT DEFAULT 'enroute' CHECK (status IN ('enroute','onscene','cleared')),
  responded_at TIMESTAMPTZ DEFAULT now(),
  arrived_at   TIMESTAMPTZ,
  cleared_at   TIMESTAMPTZ,
  UNIQUE(incident_id, user_id)
);

CREATE INDEX IF NOT EXISTS incident_responders_incident_idx ON incident_responders(incident_id);
CREATE INDEX IF NOT EXISTS incident_responders_user_idx     ON incident_responders(user_id);

ALTER TABLE incident_responders ENABLE ROW LEVEL SECURITY;

-- Members can see / manage responders only for incidents in their own tenant
DROP POLICY IF EXISTS "tenant_can_read_responders" ON incident_responders;
CREATE POLICY "tenant_can_read_responders"
  ON incident_responders FOR SELECT
  USING (incident_id IN (
    SELECT id FROM incidents WHERE tenant_id IN (SELECT get_my_tenant_ids())
  ));

DROP POLICY IF EXISTS "tenant_can_insert_responders" ON incident_responders;
CREATE POLICY "tenant_can_insert_responders"
  ON incident_responders FOR INSERT
  WITH CHECK (incident_id IN (
    SELECT id FROM incidents WHERE tenant_id IN (SELECT get_my_tenant_ids())
  ));

DROP POLICY IF EXISTS "owner_can_update_responder" ON incident_responders;
CREATE POLICY "owner_can_update_responder"
  ON incident_responders FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "owner_can_delete_responder" ON incident_responders;
CREATE POLICY "owner_can_delete_responder"
  ON incident_responders FOR DELETE
  USING (user_id = auth.uid());
