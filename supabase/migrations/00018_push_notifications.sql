-- Phase 3 — Push Notifications & Geofencing foundations
--
-- This migration adds two tables:
--   1. device_tokens                — one row per device per user, holds FCM/APNs token
--   2. notification_preferences     — one row per user with toggles for each alert type
--
-- A push fan-out is invoked by a DB trigger on `incidents` AFTER INSERT, which
-- calls a Supabase Edge Function via pg_net. The Edge Function (`send-push`)
-- reads device_tokens for the same tenant and dispatches via FCM/APNs.
--
-- Tenant scoping is enforced by RLS so a user can only see/manage rows in
-- their own tenant.

-- ============================================================================
-- 1. device_tokens
-- ============================================================================
create table if not exists public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  -- "fcm" for Android, "apns" for iOS, "expo" for development builds using Expo Push
  platform text not null check (platform in ('fcm', 'apns', 'expo')),

  -- Raw native push token (FCM registration token / APNs device token / Expo Push token)
  push_token text not null,

  -- Device hint for debugging — model name, OS version, app build
  device_label text,

  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One token per device per user — upserts replace existing rows
  unique (user_id, push_token)
);

create index if not exists idx_device_tokens_tenant on public.device_tokens(tenant_id) where enabled = true;
create index if not exists idx_device_tokens_user on public.device_tokens(user_id);

alter table public.device_tokens enable row level security;

-- A user can manage only their own device tokens
drop policy if exists "device_tokens self read" on public.device_tokens;
create policy "device_tokens self read"
  on public.device_tokens for select
  using (user_id = auth.uid());

drop policy if exists "device_tokens self insert" on public.device_tokens;
create policy "device_tokens self insert"
  on public.device_tokens for insert
  with check (user_id = auth.uid());

drop policy if exists "device_tokens self update" on public.device_tokens;
create policy "device_tokens self update"
  on public.device_tokens for update
  using (user_id = auth.uid());

drop policy if exists "device_tokens self delete" on public.device_tokens;
create policy "device_tokens self delete"
  on public.device_tokens for delete
  using (user_id = auth.uid());

-- Tenant admins can read all tokens in their tenant (used by the Edge Function
-- via the service role key, but we expose it via RLS for completeness).
drop policy if exists "device_tokens tenant admin read" on public.device_tokens;
create policy "device_tokens tenant admin read"
  on public.device_tokens for select
  using (
    exists (
      select 1
      from public.tenant_members tm
      where tm.user_id = auth.uid()
        and tm.tenant_id = device_tokens.tenant_id
        and tm.role in ('owner', 'admin')
        and tm.is_active = true
    )
  );

-- ============================================================================
-- 2. notification_preferences
-- ============================================================================
create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  -- Master switch: if false no pushes are ever delivered to this user.
  push_enabled boolean not null default true,

  -- Granular toggles
  notify_incidents boolean not null default true,            -- New incidents in your tenant
  notify_incident_responders boolean not null default true,  -- Someone responds to an incident you reported
  notify_zone_crossings boolean not null default true,       -- You enter or exit a zone
  notify_off_campus boolean not null default true,           -- You leave the tenant home perimeter
  notify_arrived_at_incident boolean not null default true,  -- Auto-arrival at incident you're responding to

  -- Quiet hours (24h local time, e.g. 22:00 -> 06:30). NULL means no quiet hours.
  quiet_start time,
  quiet_end time,

  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

drop policy if exists "notification_preferences self read" on public.notification_preferences;
create policy "notification_preferences self read"
  on public.notification_preferences for select
  using (user_id = auth.uid());

drop policy if exists "notification_preferences self upsert" on public.notification_preferences;
create policy "notification_preferences self upsert"
  on public.notification_preferences for insert
  with check (user_id = auth.uid());

drop policy if exists "notification_preferences self update" on public.notification_preferences;
create policy "notification_preferences self update"
  on public.notification_preferences for update
  using (user_id = auth.uid());

-- ============================================================================
-- 3. updated_at trigger helpers
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_device_tokens_updated_at on public.device_tokens;
create trigger trg_device_tokens_updated_at
  before update on public.device_tokens
  for each row execute function public.set_updated_at();

drop trigger if exists trg_notification_preferences_updated_at on public.notification_preferences;
create trigger trg_notification_preferences_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 4. Outbound push trigger for new incidents
--
-- When an incident is inserted we POST to the Supabase Edge Function `send-push`
-- which handles fan-out to FCM / APNs. We pass tenant_id + incident metadata.
--
-- The Edge Function URL and service role key live in DB-level GUCs configured
-- by the project owner via:
--
--   alter database postgres set "app.settings.edge_url" = 'https://<project>.supabase.co/functions/v1';
--   alter database postgres set "app.settings.service_role_key" = '<service_role_jwt>';
--
-- pg_net is enabled by default on Supabase. If not, run:
--   create extension if not exists pg_net;
-- ============================================================================
create extension if not exists pg_net;

create or replace function public.notify_new_incident()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  edge_url text;
  service_key text;
begin
  edge_url := current_setting('app.settings.edge_url', true);
  service_key := current_setting('app.settings.service_role_key', true);

  -- If the project hasn't configured the GUCs yet, do nothing rather than fail
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

drop trigger if exists trg_incidents_notify on public.incidents;
create trigger trg_incidents_notify
  after insert on public.incidents
  for each row execute function public.notify_new_incident();

comment on table public.device_tokens is
  'One row per device per user. Used by the Edge Function send-push to fan out FCM/APNs notifications.';
comment on table public.notification_preferences is
  'Per-user push preferences. The Edge Function honours these toggles before sending.';
