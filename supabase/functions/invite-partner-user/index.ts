// ============================================================================
// invite-partner-user — Supabase Edge Function (Deno)
//
// Platform admin creates a partner-portal login for an external partner
// staff member by entering an email + password DIRECTLY. No emails are ever
// sent — the admin is expected to hand the credentials to the partner out-
// of-band (Slack, SMS, phone call, in person).
//
// Behaviour:
//   1. Verifies the caller is a platform_admin.
//   2. If the email already exists in auth.users → password is ignored,
//      partner_users row is upserted so they get access on next login.
//   3. Otherwise calls supabase.auth.admin.createUser() with:
//        • email, password
//        • email_confirm: true  (skips the confirmation email entirely)
//        • user_metadata:       (NO `signup_type` — the atomic-signup trigger
//                                  skips provisioning a tenant for partner
//                                  staff, which is what we want)
//      Then upserts the partner_users row.
//
// Required Supabase secrets (auto-set in Supabase hosting):
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface InviteBody {
  partner_id: string;
  email: string;
  password?: string;
  role?: 'owner' | 'staff';
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response('method not allowed', {
      status: 405,
      headers: corsHeaders,
    });
  }

  // ─── 1. Auth check: caller must be a platform admin ───
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonError('Unauthorized', 401);
  }

  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: callerData } = await callerClient.auth.getUser();
  const callerId = callerData.user?.id;
  if (!callerId) {
    return jsonError('Unauthorized', 401);
  }

  const { data: isAdminData, error: isAdminErr } = await callerClient.rpc(
    'is_platform_admin',
  );
  if (isAdminErr || !isAdminData) {
    return jsonError('Platform admin only', 403);
  }

  // ─── 2. Parse body ───
  let body: InviteBody;
  try {
    body = await req.json();
  } catch {
    return jsonError('invalid json', 400);
  }
  const cleanEmail = (body.email || '').trim().toLowerCase();
  const partnerId = body.partner_id;
  const role: 'owner' | 'staff' = body.role === 'staff' ? 'staff' : 'owner';
  const password = (body.password || '').trim();

  if (!cleanEmail || !partnerId) {
    return jsonError('email and partner_id are required', 400);
  }
  if (!cleanEmail.includes('@')) {
    return jsonError('invalid email', 400);
  }

  // ─── 3. Service-role client for admin operations ───
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // ─── 4. Resolve user — find existing, or create with the given password ───
  let userId: string | null = null;
  let created = false;

  const existing = await findAuthUserByEmail(admin, cleanEmail);
  if (existing) {
    // User already has a ShadowField login — no password change, just grant.
    userId = existing.id;
  } else {
    // Brand-new user — admin must provide a password we can set directly.
    if (!password) {
      return jsonError(
        `No account exists for ${cleanEmail}. Enter a password so we can create one.`,
        400,
      );
    }

    console.log('[invite-partner-user] creating', cleanEmail, 'role=', role);
    const { data: createData, error: createErr } =
      await admin.auth.admin.createUser({
        email: cleanEmail,
        password,
        // Skip the confirmation email entirely — admin is vouching for them.
        email_confirm: true,
        // NO `signup_type` here — the atomic-signup trigger
        // (handle_new_auth_user) skips users without that metadata, so we
        // won't accidentally provision a tenant for partner staff.
        user_metadata: {
          partner_invite: true,
          partner_id: partnerId,
          role,
        },
      });

    if (createErr) {
      return jsonError(createErr.message ?? 'Failed to create user', 500);
    }
    userId = createData.user?.id ?? null;
    created = true;
  }

  if (!userId) {
    return jsonError('Could not resolve user_id', 500);
  }

  // ─── 5. Upsert partner_users row so they have access on first login ───
  const { error: upsertErr } = await admin
    .from('partner_users')
    .upsert(
      {
        partner_id: partnerId,
        user_id: userId,
        role,
        is_active: true,
        granted_by: callerId,
      },
      { onConflict: 'partner_id,user_id' },
    );

  if (upsertErr) {
    return jsonError(
      `User created/found, but failed to attach to partner: ${upsertErr.message}`,
      500,
    );
  }

  return jsonOk({
    user_id: userId,
    created,
    partner_id: partnerId,
    role,
    message: created
      ? `Account created for ${cleanEmail}. Share the password with them — they can log in at /login.`
      : `User ${cleanEmail} already existed. Partner access granted — they'll see /partner on next login.`,
  });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface ListedUser {
  id: string;
  email?: string | null;
}

async function findAuthUserByEmail(
  admin: ReturnType<typeof createClient>,
  email: string,
): Promise<ListedUser | null> {
  // Supabase paginates listUsers; we scan up to 5 pages of 1000 = 5k users.
  // For larger user bases, swap this for a SECURITY DEFINER RPC that selects
  // from auth.users by email.
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error || !data?.users?.length) break;
    const hit = data.users.find(
      (u: any) => (u.email || '').toLowerCase() === email,
    );
    if (hit) return { id: hit.id, email: hit.email };
    if (data.users.length < 1000) break;
  }
  return null;
}

function jsonOk(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
