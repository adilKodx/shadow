-- ============================================================
-- Fix Chat RLS: Allow all tenant members to read/send in
-- their org's non-private channels without requiring
-- explicit chat_channel_members membership.
-- ============================================================

-- Drop the old restrictive policies
DROP POLICY IF EXISTS "msg_select" ON chat_messages;
DROP POLICY IF EXISTS "msg_insert" ON chat_messages;

-- Messages: readable by anyone in the same tenant as the channel
CREATE POLICY "msg_select_v2" ON chat_messages FOR SELECT TO authenticated
  USING (
    channel_id IN (
      SELECT cc.id FROM chat_channels cc
      WHERE cc.tenant_id IN (SELECT get_my_tenant_ids())
    )
  );

-- Messages: insertable by anyone in the same tenant
CREATE POLICY "msg_insert_v2" ON chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND channel_id IN (
      SELECT cc.id FROM chat_channels cc
      WHERE cc.tenant_id IN (SELECT get_my_tenant_ids())
    )
  );

-- Also need to enable Realtime on chat_messages for live updates.
-- Run this in Supabase Dashboard → Database → Replication → enable chat_messages
-- OR via SQL:
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

-- Seed a default "General" channel for existing tenants that have no channels
INSERT INTO chat_channels (tenant_id, name, description, channel_type)
SELECT t.id, 'General', 'Team-wide communication', 'general'
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM chat_channels cc WHERE cc.tenant_id = t.id
);

-- Auto-create a General channel when a new tenant is created
CREATE OR REPLACE FUNCTION auto_create_general_channel()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO chat_channels (tenant_id, name, description, channel_type)
  VALUES (NEW.id, 'General', 'Team-wide communication', 'general');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_tenant_auto_general_channel ON tenants;
CREATE TRIGGER trg_tenant_auto_general_channel
  AFTER INSERT ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_general_channel();
