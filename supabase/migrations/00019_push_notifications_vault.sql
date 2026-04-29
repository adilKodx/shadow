-- Phase 3 follow-up — switch notify_new_incident() to read from Supabase Vault
--
-- The original 00018 migration read the Edge Function URL + service role key
-- from database GUCs set via `alter database postgres set ...`. That command
-- requires superuser privileges, which the Supabase SQL Editor does not have.
--
-- This replaces the trigger function to read both values from Vault, which
-- any user with the `service_role` or sql-editor role can manage freely via:
--
--   select vault.create_secret('<url>',       'edge_url');
--   select vault.create_secret('<jwt>',       'service_role_key');
--   select vault.update_secret((select id from vault.secrets where name='edge_url'), '<new_url>');
--
-- If either secret is missing the function silently no-ops (so the app keeps
-- working before you've finished setup).

create or replace function public.notify_new_incident()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  edge_url text;
  service_key text;
begin
  -- Read from Vault (encrypted at rest via pg_sodium)
  select decrypted_secret into edge_url
    from vault.decrypted_secrets
    where name = 'edge_url'
    limit 1;

  select decrypted_secret into service_key
    from vault.decrypted_secrets
    where name = 'service_role_key'
    limit 1;

  if edge_url is null or service_key is null or edge_url = '' or service_key = '' then
    return new;
  end if;

  perform net.http_post(
    url := edge_url || '/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object(
      'event', 'incident.created',
      'tenant_id', new.tenant_id,
      'incident_id', new.id,
      'title', new.title,
      'severity', new.severity,
      'incident_type', new.incident_type,
      'reported_by', new.reported_by,
      'latitude', new.latitude,
      'longitude', new.longitude
    )
  );
  return new;
end;
$$;
