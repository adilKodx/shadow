// ============================================================================
// send-push  —  Supabase Edge Function (Deno)
//
// Invoked by the `notify_new_incident` trigger (and other future triggers)
// to fan out push notifications to every registered device in the tenant.
//
// Supported transports:
//   • FCM v1   — Android tokens (platform = 'fcm')
//   • APNs HTTP/2 — iOS tokens (platform = 'apns')
//
// Required Supabase secrets (set with `supabase secrets set ...`):
//   FIREBASE_SERVICE_ACCOUNT  – the entire service-account JSON as one string
//   APNS_AUTH_KEY             – the .p8 contents (PEM, with BEGIN/END lines)
//   APNS_KEY_ID               – e.g. "ABCDE12345"
//   APNS_TEAM_ID              – e.g. "ABCD1234EF"
//   APNS_BUNDLE_ID            – e.g. "com.shadowfield.app"
//   APNS_USE_SANDBOX          – "true" for dev builds (uses api.sandbox.push.apple.com)
//
// `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are available automatically.
//
// Authorisation: trusts the trigger because it sends the service-role JWT.
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

interface IncidentEvent {
  event: 'incident.created' | string;
  tenant_id: string;
  incident_id: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical' | string;
  incident_type: string;
  reported_by: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface DeviceTokenRow {
  user_id: string;
  push_token: string;
  platform: 'fcm' | 'apns' | 'expo';
  enabled: boolean;
}

interface PrefRow {
  user_id: string;
  push_enabled: boolean;
  notify_incidents: boolean;
  notify_incident_responders: boolean;
  notify_zone_crossings: boolean;
  notify_off_campus: boolean;
  notify_arrived_at_incident: boolean;
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ============================================================================
// Entry point
// ============================================================================
Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 });
  }

  let payload: IncidentEvent;
  try {
    payload = await req.json();
  } catch {
    return new Response('invalid json', { status: 400 });
  }

  console.log('[send-push] event', payload.event, 'tenant', payload.tenant_id);

  if (payload.event !== 'incident.created') {
    return Response.json({ skipped: true, reason: 'unhandled event' });
  }

  // --- 1. Fetch all enabled device tokens for the tenant ---
  const { data: tokens, error: tokenErr } = await supabase
    .from('device_tokens')
    .select('user_id, push_token, platform, enabled')
    .eq('tenant_id', payload.tenant_id)
    .eq('enabled', true);

  if (tokenErr) {
    console.error('[send-push] device_tokens error', tokenErr);
    return new Response(tokenErr.message, { status: 500 });
  }
  if (!tokens || tokens.length === 0) {
    return Response.json({ sent: 0, reason: 'no devices' });
  }

  // --- 2. Fetch each user's preferences ---
  const userIds = [...new Set(tokens.map((t: DeviceTokenRow) => t.user_id))];
  const { data: prefsRows } = await supabase
    .from('notification_preferences')
    .select('*')
    .in('user_id', userIds);
  const prefsByUser = new Map<string, PrefRow>(
    (prefsRows || []).map((p: PrefRow) => [p.user_id, p]),
  );

  // --- 3. Filter out users opted out + the reporter themselves ---
  const eligible = (tokens as DeviceTokenRow[]).filter((t) => {
    if (t.user_id === payload.reported_by) return false;
    const p = prefsByUser.get(t.user_id);
    if (!p) return true; // default = receive
    return p.push_enabled && p.notify_incidents;
  });

  console.log(`[send-push] ${eligible.length}/${tokens.length} eligible`);

  // --- 4. Build the message and dispatch ---
  const sevLabel: Record<string, string> = {
    critical: '🚨 Critical',
    high: '⚠️ High',
    medium: 'Notice',
    low: 'Info',
  };
  const title = `${sevLabel[payload.severity] || 'Incident'} — ${payload.title}`;
  const body = `${prettyType(payload.incident_type)} reported in your team. Tap to respond.`;
  const data = {
    type: 'incident_created',
    incident_id: payload.incident_id,
    tenant_id: payload.tenant_id,
    severity: payload.severity,
  };

  const fcmTokens = eligible.filter((t) => t.platform === 'fcm').map((t) => t.push_token);
  const apnsTokens = eligible.filter((t) => t.platform === 'apns').map((t) => t.push_token);

  const [fcmResult, apnsResult] = await Promise.all([
    fcmTokens.length ? sendFcmBatch(fcmTokens, title, body, data) : Promise.resolve({ ok: 0, fail: 0 }),
    apnsTokens.length ? sendApnsBatch(apnsTokens, title, body, data, payload.severity) : Promise.resolve({ ok: 0, fail: 0 }),
  ]);

  return Response.json({
    fcm: { tried: fcmTokens.length, ...fcmResult },
    apns: { tried: apnsTokens.length, ...apnsResult },
  });
});

// ============================================================================
// FCM v1
// ============================================================================
async function sendFcmBatch(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<{ ok: number; fail: number }> {
  const sa = parseServiceAccount();
  if (!sa) {
    console.warn('[send-push] FIREBASE_SERVICE_ACCOUNT missing');
    return { ok: 0, fail: tokens.length };
  }
  const accessToken = await getFcmAccessToken(sa);
  if (!accessToken) return { ok: 0, fail: tokens.length };

  let ok = 0;
  let fail = 0;
  await Promise.all(
    tokens.map(async (token) => {
      try {
        const res = await fetch(
          `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: {
                token,
                notification: { title, body },
                data: stringifyValues(data),
                android: {
                  priority: 'HIGH',
                  notification: {
                    channel_id: 'incidents',
                    color: '#DC2626',
                    sound: 'default',
                  },
                },
              },
            }),
          },
        );
        if (res.ok) {
          ok++;
        } else {
          fail++;
          const txt = await res.text();
          console.warn('[fcm] HTTP', res.status, txt.slice(0, 200));
          // Auto-disable invalid tokens
          if (res.status === 404 || txt.includes('UNREGISTERED') || txt.includes('INVALID_ARGUMENT')) {
            await supabase.from('device_tokens').update({ enabled: false }).eq('push_token', token);
          }
        }
      } catch (e) {
        fail++;
        console.warn('[fcm] fetch err', e);
      }
    }),
  );
  return { ok, fail };
}

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

function parseServiceAccount(): ServiceAccount | null {
  const raw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw);
    return {
      project_id: sa.project_id,
      client_email: sa.client_email,
      private_key: (sa.private_key as string).replace(/\\n/g, '\n'),
    };
  } catch (e) {
    console.error('[send-push] cannot parse FIREBASE_SERVICE_ACCOUNT', e);
    return null;
  }
}

async function getFcmAccessToken(sa: ServiceAccount): Promise<string | null> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const claims = {
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3500,
    };
    const jwt = await signRs256(claims, sa.private_key);

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }).toString(),
    });
    if (!res.ok) {
      console.warn('[fcm] oauth fail', res.status, await res.text());
      return null;
    }
    const json = await res.json();
    return json.access_token as string;
  } catch (e) {
    console.error('[fcm] token error', e);
    return null;
  }
}

// ============================================================================
// APNs HTTP/2
// ============================================================================
async function sendApnsBatch(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, string>,
  severity: string,
): Promise<{ ok: number; fail: number }> {
  const keyId = Deno.env.get('APNS_KEY_ID');
  const teamId = Deno.env.get('APNS_TEAM_ID');
  const bundleId = Deno.env.get('APNS_BUNDLE_ID');
  const authKey = Deno.env.get('APNS_AUTH_KEY');
  const sandbox = (Deno.env.get('APNS_USE_SANDBOX') || '').toLowerCase() === 'true';

  if (!keyId || !teamId || !bundleId || !authKey) {
    console.warn('[send-push] APNs secrets missing — skipping APNs delivery');
    return { ok: 0, fail: tokens.length };
  }

  const jwt = await signApnsJwt(authKey, keyId, teamId);
  const host = sandbox ? 'api.sandbox.push.apple.com' : 'api.push.apple.com';

  const interruption =
    severity === 'critical' ? 'critical' : severity === 'high' ? 'time-sensitive' : 'active';

  let ok = 0;
  let fail = 0;
  await Promise.all(
    tokens.map(async (token) => {
      try {
        const res = await fetch(`https://${host}/3/device/${token}`, {
          method: 'POST',
          headers: {
            authorization: `bearer ${jwt}`,
            'apns-topic': bundleId,
            'apns-push-type': 'alert',
            'apns-priority': '10',
            'apns-expiration': '0',
          },
          body: JSON.stringify({
            aps: {
              alert: { title, body },
              sound: 'default',
              badge: 1,
              'interruption-level': interruption,
            },
            ...data,
          }),
        });
        if (res.status === 200) {
          ok++;
        } else {
          fail++;
          const txt = await res.text();
          console.warn('[apns] HTTP', res.status, txt.slice(0, 200));
          if (res.status === 410 || txt.includes('Unregistered') || txt.includes('BadDeviceToken')) {
            await supabase.from('device_tokens').update({ enabled: false }).eq('push_token', token);
          }
        }
      } catch (e) {
        fail++;
        console.warn('[apns] fetch err', e);
      }
    }),
  );
  return { ok, fail };
}

async function signApnsJwt(p8Pem: string, keyId: string, teamId: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const claims = { iss: teamId, iat: now };
  return signEs256(claims, p8Pem, { kid: keyId });
}

// ============================================================================
// JWT signing helpers (Deno crypto.subtle, no external deps)
// ============================================================================
function base64url(input: ArrayBuffer | string): string {
  let bytes: Uint8Array;
  if (typeof input === 'string') {
    bytes = new TextEncoder().encode(input);
  } else {
    bytes = new Uint8Array(input);
  }
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function pemToBinary(pem: string, label: string): Uint8Array {
  const cleaned = pem
    .replace(`-----BEGIN ${label}-----`, '')
    .replace(`-----END ${label}-----`, '')
    .replace(/\s+/g, '');
  const bin = atob(cleaned);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function signRs256(claims: Record<string, unknown>, pem: string): Promise<string> {
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify(claims));
  const data = `${header}.${payload}`;

  const keyData = pemToBinary(pem, 'PRIVATE KEY');
  const key = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(data));
  return `${data}.${base64url(sig)}`;
}

async function signEs256(
  claims: Record<string, unknown>,
  p8Pem: string,
  extraHeader: Record<string, string> = {},
): Promise<string> {
  const header = base64url(JSON.stringify({ alg: 'ES256', typ: 'JWT', ...extraHeader }));
  const payload = base64url(JSON.stringify(claims));
  const data = `${header}.${payload}`;

  const keyData = pemToBinary(p8Pem, 'PRIVATE KEY');
  const key = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(data),
  );
  return `${data}.${base64url(sig)}`;
}

// ============================================================================
// Helpers
// ============================================================================
function stringifyValues(obj: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of Object.keys(obj)) out[k] = String(obj[k]);
  return out;
}

function prettyType(t: string): string {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
