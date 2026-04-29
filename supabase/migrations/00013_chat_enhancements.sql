-- ============================================================
-- Chat System Enhancements
-- Reactions, replies, typing, presence, read receipts, pins
-- ============================================================

-- ─── Message enhancements ───
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES chat_messages(id);
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS reply_to_preview TEXT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS reply_to_sender TEXT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}';
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS link_preview JSONB;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS formatted_content TEXT;

-- ─── Message reactions (separate table for proper tracking) ───
CREATE TABLE IF NOT EXISTS chat_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  user_name TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_chat_reactions_msg ON chat_reactions(message_id);

ALTER TABLE chat_reactions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "cr_sel" ON chat_reactions FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "cr_ins" ON chat_reactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "cr_del" ON chat_reactions FOR DELETE TO authenticated USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Typing indicators (ephemeral, cleaned up by trigger) ───
CREATE TABLE IF NOT EXISTS chat_typing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  user_name TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

ALTER TABLE chat_typing ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "ct_sel" ON chat_typing FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "ct_ins" ON chat_typing FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "ct_upd" ON chat_typing FOR UPDATE TO authenticated USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "ct_del" ON chat_typing FOR DELETE TO authenticated USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Auto-clean stale typing indicators (older than 10 seconds)
CREATE OR REPLACE FUNCTION clean_stale_typing()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM chat_typing WHERE started_at < now() - INTERVAL '10 seconds';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_clean_typing ON chat_typing;
CREATE TRIGGER trg_clean_typing
  AFTER INSERT ON chat_typing
  FOR EACH ROW EXECUTE FUNCTION clean_stale_typing();

-- ─── Read receipts ───
CREATE TABLE IF NOT EXISTS chat_read_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  last_read_message_id UUID REFERENCES chat_messages(id),
  last_read_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

ALTER TABLE chat_read_receipts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "rr_sel" ON chat_read_receipts FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "rr_ins" ON chat_read_receipts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "rr_upd" ON chat_read_receipts FOR UPDATE TO authenticated USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Online presence ───
CREATE TABLE IF NOT EXISTS chat_presence (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  status TEXT DEFAULT 'online' CHECK (status IN ('online','away','busy','offline')),
  custom_status TEXT,
  last_seen_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE chat_presence ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "cp_sel" ON chat_presence FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "cp_ins" ON chat_presence FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "cp_upd" ON chat_presence FOR UPDATE TO authenticated USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Pinned messages ───
ALTER TABLE chat_channels ADD COLUMN IF NOT EXISTS pinned_message_ids UUID[] DEFAULT '{}';
ALTER TABLE chat_channels ADD COLUMN IF NOT EXISTS topic TEXT;
ALTER TABLE chat_channels ADD COLUMN IF NOT EXISTS icon TEXT;

-- Enable realtime on new tables
ALTER PUBLICATION supabase_realtime ADD TABLE chat_typing;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_presence;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_read_receipts;
