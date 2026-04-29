# ShadowField — Setup, API Keys & Deployment Guide

## 1. Required Environment Variables

Create a `.env` file in the project root:

```env
# ─── Supabase (REQUIRED) ───
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

That's it for env vars. Everything else is configured in Supabase directly.

## 2. Supabase Project Setup

### 2a. Create Project
1. Go to https://supabase.com → New Project
2. Choose a region close to your users
3. Copy the **Project URL** and **anon/public key** into `.env`

### 2b. Run Migrations (IN ORDER)
Go to **Supabase Dashboard → SQL Editor** and run each file sequentially:

1. `00001_initial_schema.sql` — Core tables (tenants, members, chat, incidents, alerts, POI, video feeds)
2. `00002_signup_rpc_functions.sql` — Signup RPCs (create_tenant_and_owner, join_tenant_with_invite)
3. `00003_location_tracking_and_map.sql` — GPS tracking, zones, overlays
4. `00004_seed_demo_video_feeds.sql` — Demo video feed data
5. `00005_white_label_saas.sql` — White-label partners, pricing tiers, subscriptions, billing events, terms
6. `00006_chat_encryption.sql` — E2E encryption keys (AES-256-GCM)
7. `00007_sop_action_plans.sql` — SOPs & action plan templates
8. `00008_partner_payouts.sql` — Referral/partner payout tracking
9. `00009_tenant_home_location.sql` — Home church location fields on tenants
10. `00010_attendance_schedule.sql` — Attendance events, rosters, check-ins
11. `00011_fix_chat_rls.sql` — **CRITICAL** — Fixes chat RLS + enables Realtime + seeds default channel

### 2c. Enable Realtime
Go to **Supabase Dashboard → Database → Replication** and enable realtime for:
- `chat_messages` (live chat)
- `alerts` (live alert notifications)
- `team_locations` (live map tracking)

Migration 00011 does this for chat_messages via SQL, but verify it's checked in the dashboard.

### 2d. Authentication Settings
Go to **Supabase Dashboard → Authentication → Settings**:
- **Site URL**: `https://shadowfield.app` (or your domain)
- **Redirect URLs**: Add `https://shadowfield.app/**`, `http://localhost:5180/**`
- Email confirmations: Enable or disable based on preference
- Password minimum length: Recommend 8+

### 2e. Storage Buckets
Migration 00001 auto-creates these buckets:
- `poi-photos`, `incident-photos`, `news-attachments`, `chat-files`, `tenant-branding`

Verify they exist in **Supabase Dashboard → Storage**.

## 3. External API Keys (Optional Features)

| Service | Purpose | Where to Configure |
|---------|---------|-------------------|
| **Helcim** | Payment processing | Billing settings (future server-side integration) |

The current build has **no required external API keys** beyond Supabase. Helcim integration is referenced in the UI but actual payment processing requires a Helcim merchant account and server-side API integration (Supabase Edge Function or external backend).

## 4. Deploying to ShadowField.app

### Option A: Netlify (Recommended)

1. **Push to Git** (GitLab/GitHub):
   ```bash
   git remote add origin https://gitlab.com/your-org/shadowfield.git
   git push -u origin main
   ```

2. **Connect Netlify**:
   - Go to https://app.netlify.com → "Add new site" → "Import from Git"
   - Select your repo
   - Build settings:
     - **Build command**: `npm run build`
     - **Publish directory**: `dist`
   - **Environment variables**: Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

3. **Custom Domain**:
   - Go to Netlify → Site settings → Domain management → Add custom domain
   - Add `shadowfield.app`
   - Update your domain's DNS:
     - **A record**: Point to Netlify's load balancer IP (shown in dashboard)
     - OR **CNAME**: Point `www` to `your-site.netlify.app`
   - Netlify auto-provisions SSL via Let's Encrypt

4. **SPA Routing**: Create `public/_redirects`:
   ```
   /*    /index.html   200
   ```
   (This ensures React Router works on page refresh)

### Option B: Vercel

1. Connect repo at https://vercel.com
2. Framework preset: **Vite**
3. Add env vars in Vercel dashboard
4. Custom domain: Add `shadowfield.app` in project settings, update DNS

### Option C: Cloudflare Pages

1. Connect repo at https://dash.cloudflare.com → Pages
2. Build command: `npm run build`, output: `dist`
3. Add env vars
4. Custom domain: Easy if domain is already on Cloudflare

### DNS Records for ShadowField.app

At your domain registrar (e.g., Namecheap, Cloudflare, GoDaddy):

| Type | Name | Value |
|------|------|-------|
| A | @ | (hosting provider IP) |
| CNAME | www | (hosting provider URL) |

## 5. White-Label Custom Domains

### How It Works

Each white-label partner can set a `custom_domain` in the Branding page (e.g., `security.theirchurch.org`). To make this work:

### Step 1: Partner DNS Setup
The partner adds a **CNAME record** at their domain registrar:
```
security.theirchurch.org  →  CNAME  →  shadowfield.app
```

### Step 2: Hosting Provider — Add Custom Domain
On your hosting provider (Netlify/Vercel/Cloudflare), add each partner's custom domain:

**Netlify**: Site settings → Domain management → Add domain alias
**Vercel**: Project → Settings → Domains → Add
**Cloudflare Pages**: Custom domains → Add

SSL is auto-provisioned by all three providers.

### Step 3: App Detects Domain & Loads Branding
The app already stores `custom_domain` on the `tenants` table. To make the app load the right branding based on the incoming domain, we need a small lookup at app startup. I'll implement this now.

## 6. First Login / Test Account

After running all migrations:
1. Go to the app URL (e.g., `http://localhost:5180`)
2. Click "Create one" to sign up
3. Fill in name, email, password, organization name
4. You'll be the **owner** of your new org
5. Go to **Team → Invite Member** to generate invite codes for your team

## 7. Troubleshooting

| Issue | Fix |
|-------|-----|
| Chat shows no messages | Run migration `00011_fix_chat_rls.sql`. Enable Realtime on `chat_messages`. |
| Signup fails | Run migration `00002_signup_rpc_functions.sql`. Check Supabase auth settings. |
| Map shows wrong location | Set home lat/lng in **Branding → Home Location** |
| Encryption shows "Standard TLS" | Run migration `00006_chat_encryption.sql` — auto-generates keys |
| White-label pricing missing | Run migration `00005_white_label_saas.sql` |
