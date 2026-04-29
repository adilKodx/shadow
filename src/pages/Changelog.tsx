import { ClipboardList, Calendar, CheckCircle2 } from 'lucide-react';
import { useBranding } from '../context/BrandingContext';

const CHANGELOG = [
  {
    date: '2026-04-25',
    entries: [
      'Documented and locked down env variable conventions — separate root .env (web, VITE_*) and packages/mobile/.env (Expo, EXPO_PUBLIC_* and build-time tokens) with full inline comments and .env.example templates for both',
      'Added .windsurf/workflows/env-vars.md rule so future Cascade sessions follow the conventions automatically',
      'Setup Guide screen on mobile — dedicated drawer entry that auto-detects your phone make (Xiaomi/MIUI, Samsung, Huawei, Oppo, Vivo, OnePlus, Pixel, iPhone) and shows the exact settings you need to enable for pushes and background tracking to work',
      'Setup Guide includes a current-state snapshot, Send-test-notification button, FAQ explaining what each permission does, and a troubleshooting section',
      'Notifications screen now links to the Setup Guide via a clean header card',
      'Push token registration auto-retries up to 5 times with exponential backoff to handle FCM cold-boot SERVICE_NOT_AVAILABLE errors',
      'Edge Function send-push deployed and live — fans out FCM (Android) + APNs (iOS) when an incident is inserted, honoring per-user preferences and tenant scoping',
      'Edge Function auto-disables invalid tokens (FCM 404/UNREGISTERED, APNs 410/BadDeviceToken) so stale devices stop receiving pushes',
      'DB trigger reads Edge URL + service-role key from Supabase Vault (encrypted at rest via pg_sodium) instead of database GUCs — no superuser permission needed',
      'Dynamic app.config.js auto-attaches Firebase service files when present, so expo prebuild works whether or not credentials are dropped in yet',
      'Hardened .gitignore so Firebase service-account JSON, APNs .p8 keys, and google-services.json cannot be committed accidentally',
      'Push notifications on mobile — when an incident is reported, every team phone gets a banner instantly (FCM on Android, APNs on iOS, even when the app is closed)',
      'Tap a push notification → app opens directly to Live Map zoomed on the incident pin',
      'Auto-arrival detection — when a responder walks within 30m of an incident, status auto-flips to On Scene and the phone vibrates',
      'Zone enter/exit alerts — walk into or out of a zone and your phone notifies you locally',
      'Off-campus perimeter alert — leave the tenant home perimeter and your phone tells you',
      'Background location tracking — keep sharing GPS with the team while the app is closed (toggle in Notifications)',
      'Notification Settings screen on mobile — master toggle, granular alert types (incidents, responders, arrival, zone crossings, off-campus), background tracking, and a test-notification button',
      'Per-user notification preferences stored in DB — toggles persist across devices and the server respects them before fan-out',
      'Turn-by-turn routing on Live Map — tap Route on an incident to draw a blue polyline from your GPS to the incident (web + mobile)',
      'In-app navigation panel with step-by-step directions, distance, ETA, and Drive/Walk toggle (web + mobile)',
      'Route auto-refreshes every 30 seconds as you move',
      'Incidents on Live Map — pulsing red pins with severity colors (web + mobile)',
      'Respond to incident flow — Respond / On Scene / Cancel / Mark Resolved buttons in incident popup (web + mobile)',
      'Report incident by tapping on the map, searching an address, or at your current GPS — now available on both web + mobile',
      'Active incidents pill in web top bar and warning badge button on mobile, both with count',
      'Fit-all button on web + mobile maps — zooms to show every online team member, zone, and incident',
      'Mobile Zones management — add, edit, and delete zones directly from the phone (no longer admin-only)',
      'Mobile address search via Mapbox Geocoding — type a place to drop an incident there',
      'Google Places integration on web — address autocomplete on Branding Home Location, map search bar, and Add Zone form',
      'Mobile Locate Me button (flies to GPS) and Home button (flies to tenant HQ)',
      'Native Mapbox pulsing blue dot for the current user on mobile',
      'Fix tenant signup crash — chat channel membership no longer errors on missing display_name column',
      'Fix branding Home Location not persisting after Save',
    ],
  },
  {
    date: '2026-04-23',
    entries: [
      'Add manual "Add Member" to Team page — owner/admin can create users directly with email, password, name, and role',
      'Add Changelog page with header shortcut icon',
      'Fix login crash for users without a team membership',
    ],
  },
  {
    date: '2026-04-22',
    entries: [
      'Mobile crash logging system with 7-day auto-rotation',
      'Monorepo setup — shared packages for web + mobile with npm workspaces',
      'React Native Expo mobile app with drawer navigation and bottom tabs',
      'Mobile Dashboard, News, Alerts, and More screens',
      'iOS simulator build and testing',
      'Android emulator build and testing',
      'Shared hooks architecture (useAlerts, useNews, useChat) for web and mobile',
      'Mobile UI design system with theme, safe areas, and pull-to-refresh',
    ],
  },
];

export default function ChangelogPage() {
  const { primaryColor } = useBranding();

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Hero */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-6 py-8">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
            style={{ background: `linear-gradient(135deg, ${primaryColor}, #6366f1)` }}
          >
            <ClipboardList className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Changelog</h1>
            <p className="text-sm text-white/50">What's been shipped and fixed</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
          {CHANGELOG.map((group) => (
            <div key={group.date}>
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-4 h-4 text-gray-400" />
                <h2 className="text-sm font-bold text-gray-900 tracking-wide">
                  {new Date(group.date + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </h2>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  {group.entries.length} change{group.entries.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="space-y-2 ml-1">
                {group.entries.map((entry, i) => (
                  <div key={i} className="flex items-start gap-3 group">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-gray-700 leading-relaxed">{entry}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
