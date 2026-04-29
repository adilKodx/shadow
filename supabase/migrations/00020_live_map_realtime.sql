-- ============================================================================
-- 00020_live_map_realtime.sql
--
-- Enable Postgres logical replication for the tables the mobile Live Map and
-- web Live Map subscribe to with Supabase Realtime. Without these rows being
-- part of the `supabase_realtime` publication, postgres_changes listeners in
-- useIncidents and useMap receive nothing and the UI only updates on manual
-- refetch (new incident badges stay stuck, new zones don't appear, team
-- locations stall until the next poll tick).
--
-- Safe to run multiple times — ALTER PUBLICATION ... ADD TABLE raises an
-- error if the table is already in the publication, so we guard each one.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'incidents'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.incidents;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'incident_responders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.incident_responders;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'map_zones'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.map_zones;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'member_locations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.member_locations;
  END IF;
END $$;

-- Realtime delivers only the primary key by default on UPDATE/DELETE events.
-- Setting REPLICA IDENTITY FULL makes the *entire old row* available on the
-- wire, which RLS uses to decide whether a subscriber may see the event.
-- Without FULL, subscribers sometimes miss UPDATE events for rows they
-- logically have access to (classic "badge doesn't update after status
-- change" symptom).
ALTER TABLE public.incidents           REPLICA IDENTITY FULL;
ALTER TABLE public.incident_responders REPLICA IDENTITY FULL;
ALTER TABLE public.map_zones           REPLICA IDENTITY FULL;
ALTER TABLE public.member_locations    REPLICA IDENTITY FULL;
