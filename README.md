# ShadowField — Safety & Communication Platform

A **multi-tenant, white-label security team collaboration web application** primarily built for **church security teams** and similar organizations (schools, venues, corporate campuses). It serves as a private, organization-scoped "command center" where security personnel can communicate in real-time, manage incidents, track persons of interest, view camera feeds, and broadcast alerts — all from one dashboard.

## Features

- **Dashboard** — Real-time overview of incidents, alerts, POI, and quick actions
- **Secure Team Chat** — Real-time channels with Supabase Realtime (general, team, direct, alert, command) and E2E encryption
- **Alerts System** — Emergency/warning/info/lockdown/evacuation/BOLO alerts with acknowledgment tracking
- **Incident Reporting** — Structured incident forms with severity, status workflow, photos, timeline updates
- **Persons of Interest (POI)** — Threat-level classified profiles with photos, sightings, AI risk assessment
- **News & Announcements** — Company-to-all-tenants broadcast with categories and pinning
- **Video Feeds** — Camera feed viewer supporting embed/HLS/MJPEG/YouTube/RTSP/IP cameras
- **Live Map** — Leaflet-based real-time map with team member GPS tracking and check-ins
- **Team Management** — Role-based access (owner/admin/supervisor/member/viewer), invite codes
- **SOPs & Action Plans** — Standard Operating Procedures management for security scenarios
- **Attendance & Scheduling** — Shift and attendance tracking for security teams
- **White-label Branding** — Per-tenant logo, colors, app name, tagline, custom domain
- **AI Safety Evaluation** — Threat assessment fields on POI and incidents (ready for AI integration)
- **PIN Lock** — Optional app-level PIN gate for extra device security

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + TypeScript + Vite |
| **Styling** | TailwindCSS + Framer Motion (animations) |
| **Icons** | Lucide React |
| **Backend** | Supabase (Auth, PostgreSQL DB, Realtime, Storage) |
| **Routing** | React Router v6 |
| **Maps** | Leaflet + React-Leaflet |
| **Encryption** | Web Crypto API (AES-256-GCM) for E2E chat |
| **Notifications** | React-Toastify |
| **Date Utils** | date-fns |

There is **no separate backend server** — the app talks directly to Supabase. All business logic lives either in the React client or in PostgreSQL RPC functions + RLS policies.

## Getting Started

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your Supabase project URL and anon key
   ```

3. **Apply database migrations**
   Run all SQL files in `supabase/migrations/` (in order) in your Supabase SQL Editor, starting with `00001_initial_schema.sql`.

4. **Start dev server**
   ```bash
   npm run dev
   ```
   App runs on http://localhost:5180

## Core Architectural Concept: Multi-Tenancy

The most important design pattern is **multi-tenancy with Row-Level Security (RLS)**:

- Each organization (church, company) is a **tenant** (`tenants` table)
- Users belong to tenants via `tenant_members` with roles: `owner`, `admin`, `supervisor`, `member`, `viewer`
- **Every data table** (`incidents`, `alerts`, `poi_records`, `chat_channels`, etc.) has a `tenant_id` column
- A PostgreSQL function `get_my_tenant_ids()` returns the tenant IDs the current user belongs to
- **All RLS policies** use this function, so users can only ever see/modify data from their own organization — enforced at the database level, not the application level
- New users either **create a new org** or **join an existing one via invite code**, both handled by Supabase RPC functions (`create_tenant_and_owner`, `join_tenant_with_invite`)

## Project Structure

```
shadowfield/
├── src/
│   ├── App.tsx                  # Root component — routing & provider wrappers
│   ├── main.tsx                 # Vite entry point
│   ├── vite-env.d.ts
│   ├── context/                 # React Contexts (global state)
│   │   ├── AuthContext.tsx       # Supabase auth, user session, tenant & member data
│   │   └── BrandingContext.tsx   # White-label branding resolution
│   ├── components/              # Shared UI components
│   │   ├── Layout.tsx           # Sidebar + Header + Outlet shell
│   │   ├── Sidebar.tsx          # Navigation sidebar
│   │   ├── Header.tsx           # Top header bar
│   │   ├── ProtectedRoute.tsx   # Auth guard — redirects to /login if not authenticated
│   │   ├── PinLock.tsx          # PIN entry UI
│   │   ├── PinLockGate.tsx      # PIN lock wrapper gate
│   │   ├── TermsGate.tsx        # Terms acceptance gate
│   │   └── ToastNotifications.tsx
│   ├── hooks/                   # Custom hooks — one per module
│   │   ├── useAlerts.ts         # Alerts CRUD + realtime
│   │   ├── useAttendance.ts     # Attendance & scheduling
│   │   ├── useChat.ts           # Chat channels, messages, encryption, realtime
│   │   ├── useIncidents.ts      # Incident CRUD + status workflow
│   │   ├── useMap.ts            # GPS location tracking
│   │   ├── useNews.ts           # News posts CRUD
│   │   ├── useNotifications.ts  # Push/toast notification logic
│   │   ├── usePOI.ts            # Persons of Interest CRUD
│   │   ├── useSOPs.ts           # Standard Operating Procedures
│   │   ├── useTeam.ts           # Team members & invites
│   │   ├── useVideoFeeds.ts     # Camera feed management
│   │   └── useWhiteLabel.ts     # White-label SaaS admin
│   ├── lib/                     # Utility libraries
│   │   ├── supabase.ts          # Supabase client initialization
│   │   └── encryption.ts        # AES-256-GCM E2E encryption (Web Crypto API)
│   └── pages/                   # Page-level components (one per route)
│       ├── Login.tsx
│       ├── Signup.tsx
│       ├── PartnerSignup.tsx
│       ├── Dashboard.tsx
│       ├── Chat.tsx
│       ├── Alerts.tsx
│       ├── Incidents.tsx
│       ├── POI.tsx
│       ├── News.tsx
│       ├── VideoFeeds.tsx
│       ├── LiveMap.tsx
│       ├── Team.tsx
│       ├── SOPs.tsx
│       ├── Attendance.tsx
│       ├── Branding.tsx
│       ├── WhiteLabelAdmin.tsx
│       └── Settings.tsx
├── supabase/
│   ├── migrations/              # 16 SQL migration files (schema evolution)
│   └── functions/               # Supabase Edge Functions
├── public/
├── styles.css
├── tailwind.config.js
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Routing & Guards

```
Public routes:
  /login                → Login page
  /signup               → Signup (create org or join via invite)
  /signup/:slug         → Partner-specific signup page

Protected routes (require auth + tenant + terms + optional PIN):
  /dashboard            → Dashboard
  /chat                 → Secure Team Chat
  /alerts               → Alerts System
  /incidents            → Incident Reporting
  /poi                  → Persons of Interest
  /news                 → News & Announcements
  /video-feeds          → Video Feeds
  /team                 → Team Management
  /branding             → Tenant Branding Settings
  /white-label          → White-Label Admin Panel
  /sops                 → SOPs & Action Plans
  /attendance           → Attendance & Scheduling
  /settings             → User Settings
  /map                  → Live Map

Default: /* → redirects to /dashboard
```

All protected routes are wrapped in:
`ProtectedRoute` → `TermsGate` → `PinLockGate` → `Layout` (Sidebar + Header + page content)

## Application Modules

### 1. Authentication (`Login.tsx`, `Signup.tsx`, `PartnerSignup.tsx`)
- Email/password auth via Supabase Auth
- Signup has two flows: **create a new org** OR **join via invite code**
- `PartnerSignup` (`/signup/:slug`) enables white-label partner-specific signup pages
- `AuthContext` manages session state, loads tenant + member data on login, and tracks `last_seen_at`

### 2. Dashboard (`Dashboard.tsx`)
- Real-time overview: active alerts count, open incidents, POI count, recent activity
- Quick-action buttons for creating alerts, incidents, etc.

### 3. Secure Team Chat (`Chat.tsx` + `useChat.ts`)
- Real-time messaging via **Supabase Realtime** subscriptions on `chat_messages`
- Channel types: `general`, `team`, `direct`, `alert`, `command`
- **End-to-end encryption** using AES-256-GCM (`src/lib/encryption.ts`):
  - Each tenant has a 256-bit symmetric key stored in `tenant_encryption_keys` (RLS-protected)
  - Messages are encrypted client-side before insert, decrypted on read
  - Format: `base64(12-byte IV + ciphertext)`
- File/image sharing via Supabase Storage (`chat-files` bucket)

### 4. Alerts System (`Alerts.tsx` + `useAlerts.ts`)
- Alert types: `emergency`, `warning`, `info`, `all_clear`, `lockdown`, `evacuation`, `bolo`, `weather`, `medical`, `custom`
- Priority levels: `low`, `normal`, `high`, `critical`
- Role-based targeting (send to specific roles or all)
- **Acknowledgment tracking** — tracks who has seen/acknowledged each alert

### 5. Incident Reporting (`Incidents.tsx` + `useIncidents.ts`)
- Structured forms with incident type (security breach, theft, assault, trespass, vandalism, medical, fire, etc.)
- Severity: `low`, `medium`, `high`, `critical`
- Status pipeline: `reported` → `investigating` → `contained` → `resolved` → `closed` / `escalated`
- Auto-generated incident numbers (`INC-00001`) via PostgreSQL trigger
- Photo uploads, timeline updates (`incident_updates`), team member assignment
- Optional link to POI records
- AI severity scoring & analysis fields (ready for integration)

### 6. Persons of Interest (`POI.tsx` + `usePOI.ts`)
- Threat levels: `low`, `medium`, `high`, `critical`
- Statuses: `active`, `inactive`, `resolved`, `banned`, `watch`
- Categories: trespass, theft, assault, harassment, suspicious, banned, known offender, missing
- Detailed physical descriptions (height, weight, hair/eye color, distinguishing marks)
- Known associates, vehicles, addresses
- Photo management (`poi_photos`) + sighting reports with GPS (`poi_sightings`)
- AI risk score and assessment fields

### 7. News & Announcements (`News.tsx` + `useNews.ts`)
- Categories: announcement, update, policy, training, safety, event, general
- Priority: normal, important, urgent
- Pinning, publish scheduling, view count tracking
- Global broadcast capability (company-level → all tenants)

### 8. Video Feeds (`VideoFeeds.tsx` + `useVideoFeeds.ts`)
- Camera feed viewer supporting: `embed`, `hls`, `mjpeg`, `youtube`, `rtsp`, `ip_camera`
- Grid layout with configurable positions
- Status monitoring: `online`, `offline`, `maintenance`, `error`

### 9. Live Map (`LiveMap.tsx` + `useMap.ts`)
- Leaflet-based real-time map
- Team member GPS location tracking and check-in
- Configurable home location per tenant (`home_lat`, `home_lng`, `home_zoom`, `home_address`)

### 10. Team Management (`Team.tsx` + `useTeam.ts`)
- Member list with role-based access control
- Roles hierarchy: `owner` → `admin` → `supervisor` → `member` → `viewer`
- Invite code generation with max uses, expiry dates, and role assignment
- Member activation/deactivation

### 11. SOPs & Action Plans (`SOPs.tsx` + `useSOPs.ts`)
- Standard Operating Procedures document management
- Structured action plans for security scenarios

### 12. Attendance & Scheduling (`Attendance.tsx` + `useAttendance.ts`)
- Shift scheduling and attendance tracking for security teams

### 13. White-Label & Branding (`Branding.tsx`, `WhiteLabelAdmin.tsx`, `useWhiteLabel.ts`)
- Per-tenant customization: logo, colors (primary/secondary/accent), app name, tagline, favicon, login background
- Custom domain support — `BrandingContext` detects hostname on load and applies matching tenant branding
- Branding priority: logged-in tenant > custom domain detection > defaults
- White-label admin panel for managing partner organizations, subscription tiers, and billing
- Subscription tiers: `free`, `starter`, `professional`, `enterprise`

### 14. Settings (`Settings.tsx`)
- User profile management
- PIN lock configuration (`PinLock.tsx`, `PinLockGate.tsx`) — optional app-level PIN for extra device security
- Notification preferences

## Contexts (Global State)

### `AuthContext` (`src/context/AuthContext.tsx`)
- Manages Supabase auth session (`user`, `session`)
- Loads current `tenant` and `member` data on auth state change
- Provides `signIn`, `signUp`, `signOut`, `refreshTenant` methods
- Tracks `last_seen_at` for team presence

### `BrandingContext` (`src/context/BrandingContext.tsx`)
- Resolves white-label branding with priority: **logged-in tenant** > **custom domain match** > **defaults**
- Dynamically updates page title and favicon
- Provides `appName`, `tagline`, `logoUrl`, `primaryColor`, `secondaryColor`, `accentColor`, etc.

## Custom Hooks Pattern

Each module has a dedicated hook in `src/hooks/` that encapsulates **all Supabase queries, realtime subscriptions, and CRUD operations** for that feature. This cleanly separates data logic from UI:

| Hook | Responsibility |
|------|---------------|
| `useAlerts` | Alerts CRUD, acknowledgments, realtime |
| `useAttendance` | Attendance records and scheduling |
| `useChat` | Channels, messages, encryption, realtime subscriptions |
| `useIncidents` | Incident CRUD, status updates, timeline, photos |
| `useMap` | GPS location tracking, member positions |
| `useNews` | News post CRUD |
| `useNotifications` | Toast and push notification logic |
| `usePOI` | POI records, photos, sightings |
| `useSOPs` | Standard Operating Procedures CRUD |
| `useTeam` | Team members, invites, role management |
| `useVideoFeeds` | Camera feed CRUD and status |
| `useWhiteLabel` | White-label admin, partners, subscription management |

## Database Schema

### Tables

See `supabase/migrations/` for full schema (16 migration files). Key tables:

| Table | Purpose |
|-------|---------|
| `tenants` | Organizations with branding config, subscription tier, feature flags |
| `tenant_members` | Users with roles (`owner`/`admin`/`supervisor`/`member`/`viewer`) |
| `tenant_invites` | Invite codes with max uses and expiry |
| `chat_channels` | Chat channels (general/team/direct/alert/command) |
| `chat_channel_members` | Channel membership and read state |
| `chat_messages` | Messages (text/image/file/alert/system/location) |
| `news_posts` | News and announcements |
| `news_attachments` | File attachments for news posts |
| `poi_records` | Persons of interest with threat classification |
| `poi_photos` | POI photo gallery |
| `poi_sightings` | POI sighting reports with GPS |
| `incidents` | Incident reports with severity/status workflow |
| `incident_photos` | Incident photo evidence |
| `incident_updates` | Incident timeline entries |
| `alerts` | System alerts with priority and targeting |
| `alert_acknowledgments` | Alert acknowledgment tracking |
| `video_feeds` | Camera feed configuration |
| `activity_log` | Audit trail |

### Row-Level Security (RLS)

Every table has RLS enabled. Policies use `get_my_tenant_ids()` to scope all data access to the current user's tenant(s). Child tables (photos, updates, acknowledgments) inherit access through their parent FK relationships.

### Migrations

| Migration | Purpose |
|-----------|---------|
| `00001_initial_schema.sql` | Core tables, RLS policies, indexes, storage buckets |
| `00002_signup_rpc_functions.sql` | `create_tenant_and_owner` + `join_tenant_with_invite` RPCs |
| `00003_location_tracking_and_map.sql` | GPS tracking and map features |
| `00004_seed_demo_video_feeds.sql` | Demo camera feed data |
| `00005_white_label_saas.sql` | White-label SaaS, partners, subscription tiers |
| `00006_chat_encryption.sql` | E2E encryption keys table |
| `00007_sop_action_plans.sql` | SOPs and action plan tables |
| `00008_partner_payouts.sql` | Partner payout tracking |
| `00009_tenant_home_location.sql` | Tenant home location for map |
| `00010_attendance_schedule.sql` | Attendance and shift scheduling |
| `00011_fix_chat_rls.sql` | Chat RLS policy fixes |
| `00012_custom_domain_branding.sql` | Custom domain branding support |
| `00012_helcim_billing.sql` | Helcim billing integration |
| `00013_chat_enhancements.sql` | Chat feature enhancements |
| `00014_enforce_member_caps.sql` | Member cap enforcement per tier |
| `00015_invite_email_columns.sql` | Invite email tracking columns |

## Encryption

Chat messages use **AES-256-GCM** end-to-end encryption via the Web Crypto API (`src/lib/encryption.ts`):

- Each tenant gets a 256-bit symmetric key generated at org creation
- Messages are encrypted client-side before database insert, decrypted on read
- Key is stored base64-encoded in `tenant_encryption_keys` (RLS-protected)
- Format: `base64(12-byte IV + ciphertext)`
- Graceful fallback: if decryption fails, returns original content (for legacy unencrypted messages)
