-- ============================================================
-- Attendance Schedule & Check-In System
-- Track who is on the book for services/events and their status
-- ============================================================

-- ─── Events / Services ───
CREATE TABLE IF NOT EXISTS attendance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'sunday_service','wednesday_service','special_event',
    'rehearsal','meeting','training','outreach','other'
  )) DEFAULT 'sunday_service',
  location TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule TEXT, -- e.g. 'weekly', 'biweekly', 'monthly'
  recurrence_day INT,   -- 0=Sun, 1=Mon, ...
  color TEXT DEFAULT '#3B82F6',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_att_events_tenant ON attendance_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_att_events_start ON attendance_events(start_time);

-- ─── Schedule Roster (who is expected at an event) ───
CREATE TABLE IF NOT EXISTS attendance_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES attendance_events(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES tenant_members(id) ON DELETE CASCADE,
  role_assignment TEXT, -- e.g. 'Team Lead', 'Entrance A', 'Parking', 'Roamer'
  is_required BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_att_sched_event ON attendance_schedules(event_id);
CREATE INDEX IF NOT EXISTS idx_att_sched_member ON attendance_schedules(member_id);

-- ─── Check-In Records ───
CREATE TABLE IF NOT EXISTS attendance_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES attendance_events(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES tenant_members(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN (
    'checked_in','checked_out','late','sick','excused','no_show','on_break','standby'
  )) DEFAULT 'checked_in',
  checked_in_at TIMESTAMPTZ,
  checked_out_at TIMESTAMPTZ,
  checked_in_by UUID REFERENCES auth.users(id),
  location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_att_checkin_event ON attendance_checkins(event_id);
CREATE INDEX IF NOT EXISTS idx_att_checkin_member ON attendance_checkins(member_id);
CREATE INDEX IF NOT EXISTS idx_att_checkin_status ON attendance_checkins(status);

-- ─── RLS ───
ALTER TABLE attendance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_checkins ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "ae_sel" ON attendance_events FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "ae_ins" ON attendance_events FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "ae_upd" ON attendance_events FOR UPDATE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "ae_del" ON attendance_events FOR DELETE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "as_sel" ON attendance_schedules FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "as_ins" ON attendance_schedules FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "as_upd" ON attendance_schedules FOR UPDATE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "as_del" ON attendance_schedules FOR DELETE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "ac_sel" ON attendance_checkins FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "ac_ins" ON attendance_checkins FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "ac_upd" ON attendance_checkins FOR UPDATE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "ac_del" ON attendance_checkins FOR DELETE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
