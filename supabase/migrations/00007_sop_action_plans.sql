-- ============================================================
-- ShadowField — SOPs & Action Plans
-- ============================================================

-- ─── SOP Templates ───
CREATE TABLE IF NOT EXISTS sops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN (
    'active_shooter','medical','fire','evacuation','suspicious_person',
    'bomb_threat','weather','power_outage','lockdown','intruder',
    'missing_child','domestic_violence','trespassing','custom'
  )) DEFAULT 'custom',
  priority TEXT CHECK (priority IN ('low','medium','high','critical')) DEFAULT 'high',
  estimated_minutes INT,
  icon TEXT,
  color TEXT DEFAULT '#EF4444',
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sops_tenant ON sops(tenant_id);

-- ─── SOP Steps (template steps) ───
CREATE TABLE IF NOT EXISTS sop_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sop_id UUID NOT NULL REFERENCES sops(id) ON DELETE CASCADE,
  step_number INT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  responsible_role TEXT,
  estimated_minutes INT,
  is_critical BOOLEAN DEFAULT false,
  requires_confirmation BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sop_steps_sop ON sop_steps(sop_id, sort_order);

-- ─── Action Plans (live instances) ───
CREATE TABLE IF NOT EXISTS action_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sop_id UUID REFERENCES sops(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft','active','completed','cancelled')) DEFAULT 'draft',
  priority TEXT CHECK (priority IN ('low','medium','high','critical')) DEFAULT 'high',
  category TEXT,
  triggered_by UUID REFERENCES auth.users(id),
  triggered_by_name TEXT,
  triggered_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_action_plans_tenant ON action_plans(tenant_id, status);

-- ─── Action Plan Steps (live step tracking) ───
CREATE TABLE IF NOT EXISTS action_plan_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES action_plans(id) ON DELETE CASCADE,
  sop_step_id UUID REFERENCES sop_steps(id) ON DELETE SET NULL,
  step_number INT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','in_progress','completed','skipped')) DEFAULT 'pending',
  responsible_role TEXT,
  assigned_to UUID REFERENCES auth.users(id),
  assigned_name TEXT,
  is_critical BOOLEAN DEFAULT false,
  requires_confirmation BOOLEAN DEFAULT false,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id),
  completed_by_name TEXT,
  notes TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_action_plan_steps_plan ON action_plan_steps(plan_id, sort_order);

-- ─── RLS ───
ALTER TABLE sops ENABLE ROW LEVEL SECURITY;
ALTER TABLE sop_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_plan_steps ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "sops_select" ON sops FOR SELECT TO authenticated
    USING (tenant_id IN (SELECT get_my_tenant_ids()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "sops_insert" ON sops FOR INSERT TO authenticated
    WITH CHECK (tenant_id IN (SELECT get_my_tenant_ids()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "sops_update" ON sops FOR UPDATE TO authenticated
    USING (tenant_id IN (SELECT get_my_tenant_ids()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "sops_delete" ON sops FOR DELETE TO authenticated
    USING (tenant_id IN (SELECT get_my_tenant_ids()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "sop_steps_select" ON sop_steps FOR SELECT TO authenticated
    USING (sop_id IN (SELECT id FROM sops WHERE tenant_id IN (SELECT get_my_tenant_ids())));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "sop_steps_insert" ON sop_steps FOR INSERT TO authenticated
    WITH CHECK (sop_id IN (SELECT id FROM sops WHERE tenant_id IN (SELECT get_my_tenant_ids())));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "sop_steps_update" ON sop_steps FOR UPDATE TO authenticated
    USING (sop_id IN (SELECT id FROM sops WHERE tenant_id IN (SELECT get_my_tenant_ids())));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "sop_steps_delete" ON sop_steps FOR DELETE TO authenticated
    USING (sop_id IN (SELECT id FROM sops WHERE tenant_id IN (SELECT get_my_tenant_ids())));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "ap_select" ON action_plans FOR SELECT TO authenticated
    USING (tenant_id IN (SELECT get_my_tenant_ids()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "ap_insert" ON action_plans FOR INSERT TO authenticated
    WITH CHECK (tenant_id IN (SELECT get_my_tenant_ids()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "ap_update" ON action_plans FOR UPDATE TO authenticated
    USING (tenant_id IN (SELECT get_my_tenant_ids()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "ap_delete" ON action_plans FOR DELETE TO authenticated
    USING (tenant_id IN (SELECT get_my_tenant_ids()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "aps_select" ON action_plan_steps FOR SELECT TO authenticated
    USING (plan_id IN (SELECT id FROM action_plans WHERE tenant_id IN (SELECT get_my_tenant_ids())));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "aps_insert" ON action_plan_steps FOR INSERT TO authenticated
    WITH CHECK (plan_id IN (SELECT id FROM action_plans WHERE tenant_id IN (SELECT get_my_tenant_ids())));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "aps_update" ON action_plan_steps FOR UPDATE TO authenticated
    USING (plan_id IN (SELECT id FROM action_plans WHERE tenant_id IN (SELECT get_my_tenant_ids())));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "aps_delete" ON action_plan_steps FOR DELETE TO authenticated
    USING (plan_id IN (SELECT id FROM action_plans WHERE tenant_id IN (SELECT get_my_tenant_ids())));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Seed starter SOP templates ───
-- These will be created per-tenant on first use via RPC, but we define
-- a helper function to seed them for a tenant.

CREATE OR REPLACE FUNCTION seed_default_sops(p_tenant_id UUID, p_created_by UUID)
RETURNS VOID AS $$
DECLARE
  v_sop_id UUID;
BEGIN
  -- 1. Active Shooter
  INSERT INTO sops (tenant_id, title, description, category, priority, estimated_minutes, icon, color, created_by, sort_order)
  VALUES (p_tenant_id, 'Active Shooter Response', 'Immediate response protocol for active shooter situations. Follow RUN-HIDE-FIGHT methodology.', 'active_shooter', 'critical', 15, '🔫', '#DC2626', p_created_by, 1)
  RETURNING id INTO v_sop_id;

  INSERT INTO sop_steps (sop_id, step_number, title, description, responsible_role, is_critical, requires_confirmation, sort_order) VALUES
    (v_sop_id, 1, 'Verify Threat', 'Confirm the threat is real. Identify location, number of shooters, description.', 'Team Lead', true, true, 1),
    (v_sop_id, 2, 'Activate Lockdown', 'Trigger facility lockdown via app or PA system. Lock all exterior doors.', 'Team Lead', true, true, 2),
    (v_sop_id, 3, 'Call 911', 'Provide: location, number of shooters, description, weapons, number of potential victims.', 'Comms Officer', true, true, 3),
    (v_sop_id, 4, 'Notify All Team Members', 'Send emergency alert to all security team via app.', 'Comms Officer', true, false, 4),
    (v_sop_id, 5, 'Evacuate Safe Areas', 'Guide congregation away from threat toward designated exit routes.', 'All Members', true, false, 5),
    (v_sop_id, 6, 'Secure Children & Nursery', 'Lock nursery and children areas. Account for all children.', 'Nursery Lead', true, true, 6),
    (v_sop_id, 7, 'Direct to Rally Points', 'Guide evacuees to pre-designated rally points away from building.', 'Exit Guards', false, false, 7),
    (v_sop_id, 8, 'Meet Law Enforcement', 'Designate one person to meet arriving officers. Provide building layout.', 'Team Lead', true, true, 8),
    (v_sop_id, 9, 'Account for All Personnel', 'Use team roster to verify all members and congregation are accounted for.', 'All Members', true, false, 9),
    (v_sop_id, 10, 'Secure Scene for Investigation', 'Do not disturb evidence. Keep witnesses separated.', 'Team Lead', false, false, 10);

  -- 2. Medical Emergency
  INSERT INTO sops (tenant_id, title, description, category, priority, estimated_minutes, icon, color, created_by, sort_order)
  VALUES (p_tenant_id, 'Medical Emergency', 'Response protocol for medical emergencies including cardiac events, falls, allergic reactions.', 'medical', 'high', 10, '🏥', '#EC4899', p_created_by, 2)
  RETURNING id INTO v_sop_id;

  INSERT INTO sop_steps (sop_id, step_number, title, description, responsible_role, is_critical, requires_confirmation, sort_order) VALUES
    (v_sop_id, 1, 'Assess the Situation', 'Check responsiveness, breathing, visible injuries. Do NOT move the person unless in danger.', 'First Responder', true, false, 1),
    (v_sop_id, 2, 'Call 911', 'Provide exact location within facility, nature of emergency, patient condition.', 'Comms Officer', true, true, 2),
    (v_sop_id, 3, 'Begin First Aid / CPR', 'If trained, begin appropriate first aid. Use AED if available and needed.', 'First Responder', true, false, 3),
    (v_sop_id, 4, 'Clear the Area', 'Move bystanders away. Maintain dignity and privacy of the patient.', 'Security Member', false, false, 4),
    (v_sop_id, 5, 'Guide EMS to Location', 'Station someone at entrance to direct paramedics to patient.', 'Exit Guard', true, false, 5),
    (v_sop_id, 6, 'Notify Family/Emergency Contact', 'Contact family if known. Do NOT share medical details publicly.', 'Team Lead', false, false, 6),
    (v_sop_id, 7, 'Document Incident', 'File incident report with timeline, actions taken, responders involved.', 'Team Lead', false, false, 7);

  -- 3. Fire / Evacuation
  INSERT INTO sops (tenant_id, title, description, category, priority, estimated_minutes, icon, color, created_by, sort_order)
  VALUES (p_tenant_id, 'Fire & Evacuation', 'Building evacuation protocol for fire, gas leak, or structural emergency.', 'fire', 'critical', 20, '🔥', '#F97316', p_created_by, 3)
  RETURNING id INTO v_sop_id;

  INSERT INTO sop_steps (sop_id, step_number, title, description, responsible_role, is_critical, requires_confirmation, sort_order) VALUES
    (v_sop_id, 1, 'Activate Fire Alarm', 'Pull nearest fire alarm. If automated system, verify it activated.', 'First on Scene', true, true, 1),
    (v_sop_id, 2, 'Call 911', 'Report fire: location, size, what is burning, anyone trapped.', 'Comms Officer', true, true, 2),
    (v_sop_id, 3, 'Begin Evacuation', 'Direct all occupants to nearest exits using designated routes.', 'All Members', true, false, 3),
    (v_sop_id, 4, 'Check All Rooms', 'Sweep assigned areas. Check restrooms, offices, closets.', 'Assigned Sweepers', true, true, 4),
    (v_sop_id, 5, 'Secure Children & Nursery', 'Evacuate nursery via designated kid-safe exit. Headcount required.', 'Nursery Lead', true, true, 5),
    (v_sop_id, 6, 'Assist Mobility-Impaired', 'Help elderly and disabled to exits. Use evac chairs if available.', 'Assigned Members', true, false, 6),
    (v_sop_id, 7, 'Rally Point Headcount', 'All teams report headcount at designated rally point.', 'Team Lead', true, true, 7),
    (v_sop_id, 8, 'Meet Fire Department', 'Provide building layout, hazmat info, and account for missing persons.', 'Team Lead', true, false, 8);

  -- 4. Suspicious Person
  INSERT INTO sops (tenant_id, title, description, category, priority, estimated_minutes, icon, color, created_by, sort_order)
  VALUES (p_tenant_id, 'Suspicious Person', 'Protocol for handling unknown or suspicious individuals on premises.', 'suspicious_person', 'medium', 10, '👤', '#8B5CF6', p_created_by, 4)
  RETURNING id INTO v_sop_id;

  INSERT INTO sop_steps (sop_id, step_number, title, description, responsible_role, is_critical, requires_confirmation, sort_order) VALUES
    (v_sop_id, 1, 'Observe & Report', 'Note description, behavior, location. Do NOT confront alone.', 'Spotter', true, false, 1),
    (v_sop_id, 2, 'Notify Team Lead', 'Radio or message team lead with details and current location.', 'Spotter', true, false, 2),
    (v_sop_id, 3, 'Approach in Pairs', 'Two team members approach. Be friendly but direct: "Can we help you?"', 'Security Pair', true, false, 3),
    (v_sop_id, 4, 'Verify Identity/Purpose', 'Ask name, who they are visiting, purpose. Cross-reference POI list.', 'Security Pair', true, false, 4),
    (v_sop_id, 5, 'Escort or Monitor', 'If legitimate: escort to destination. If suspicious: maintain visual contact.', 'Security Member', false, false, 5),
    (v_sop_id, 6, 'Escalate if Needed', 'If person becomes aggressive or refuses to leave, call law enforcement.', 'Team Lead', true, true, 6),
    (v_sop_id, 7, 'Document & Add to POI', 'Record description, photos if possible, add to POI database.', 'Team Lead', false, false, 7);

  -- 5. Missing Child
  INSERT INTO sops (tenant_id, title, description, category, priority, estimated_minutes, icon, color, created_by, sort_order)
  VALUES (p_tenant_id, 'Missing Child', 'Immediate response for a child reported missing from the facility.', 'missing_child', 'critical', 15, '👶', '#F59E0B', p_created_by, 5)
  RETURNING id INTO v_sop_id;

  INSERT INTO sop_steps (sop_id, step_number, title, description, responsible_role, is_critical, requires_confirmation, sort_order) VALUES
    (v_sop_id, 1, 'Get Child Description', 'Name, age, clothing, last known location, who they were with.', 'Team Lead', true, false, 1),
    (v_sop_id, 2, 'Lock All Exits', 'No one leaves the building until child is found. Post guards at every exit.', 'All Exit Guards', true, true, 2),
    (v_sop_id, 3, 'Search Last Known Area', 'Check under pews, in closets, restrooms, behind curtains in last known area.', 'Search Team', true, false, 3),
    (v_sop_id, 4, 'Systematic Building Sweep', 'Divide building into sectors. Each team clears and reports.', 'All Members', true, true, 4),
    (v_sop_id, 5, 'Check Parking Lot & Exterior', 'Search vehicles, playground, dumpster areas, nearby streets.', 'Exterior Team', true, false, 5),
    (v_sop_id, 6, 'Call 911 (if not found in 10 min)', 'If child not located within 10 minutes, contact law enforcement immediately.', 'Team Lead', true, true, 6),
    (v_sop_id, 7, 'Review Camera Footage', 'Check video feeds for last sighting and anyone leaving with a child.', 'Comms Officer', true, false, 7),
    (v_sop_id, 8, 'Notify Parents/Guardians', 'Keep parents informed and calm. Assign a team member to stay with them.', 'Team Lead', true, false, 8);

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
