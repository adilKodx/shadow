# Changelog

All notable features and bug fixes shipped in ShadowField (newest first).

---

## 2026-04-28

- Partner Portal multi-partner switcher — when a single user is granted access to more than one white-label partner (e.g. eidhi + Sheperly), the portal header shows a dropdown to switch contexts; selection persists in `localStorage` across reloads
- AuthContext now exposes `partnerMemberships` (array of all active grants) alongside `partnerMembership` (currently selected) and a `selectPartner(id)` setter
- Partner Portal — white-label partners (e.g. Sheperly staff) can now sign in and self-manage their brand, pricing, tenants, and payouts at `/partner`
- New `partner_users` table + RLS (migration `00022_partner_portal.sql`) lets a single auth user be both a tenant member and a partner user simultaneously
- Platform-owner toggle `pricing_self_managed` on `white_label_partners` controls whether partners can edit their own `partner_pricing` rows; default OFF
- Auto-commission trigger on `billing_events` (migration `00023_commission_automation.sql`) — every successful payment now auto-stamps `partner_id` and `commission_amount` based on the linked subscription's `partner_commission_pct`, no app code change required
- `aggregate_partner_payouts()` SQL function rolls up unpaid commission events into a single `partner_payouts` row per partner per period; idempotent via `billing_events.payout_id` linking; runs weekly via `pg_cron` when the extension is available
- `confirm_partner_payout()` SQL function lets platform admins atomically mark a payout paid and flip every linked `billing_events.commission_paid` flag in one call
- Relaxed `billing_events.event_type` CHECK constraint to match what the `helcim-billing` Edge Function actually inserts (`payment`, `card_updated`, `card_removed`, `upgrade`, `downgrade`)
- White-Label Admin (`/white-label`) now has a Partner Portal Access section — platform admins can grant or revoke partner-portal access by email and toggle the per-partner Pricing Self-Management switch
- AuthContext now exposes `partnerMembership` (partner_id, partner_slug, role, pricing_self_managed) so any UI can branch on partner vs tenant vs platform-admin role
- Sidebar shows a new Partner Portal link only to users with an active `partner_users` row

---

## 2026-04-26

- Live Map now updates instantly via Supabase realtime — when anyone moves, reports an incident, joins as a responder, or edits a zone, every other phone/web client sees the change within ~1s instead of waiting up to 10s for the next poll
- Migration `00020_live_map_realtime.sql` adds `incidents`, `incident_responders`, `map_zones`, and `member_locations` to the `supabase_realtime` publication and sets `REPLICA IDENTITY FULL` so RLS-filtered UPDATE/DELETE events reach subscribers reliably
- Fix critical hidden bug: background location tracking on mobile was silently failing for months — the background task inserted into a non-existent `team_locations` table. It now calls the same `report_member_location` RPC the foreground watcher uses, so phones actually report GPS when the app is closed
- Background location tracker now stores the user's display name in AsyncStorage so the cold-start task can write a complete row even when launched without a React tree
- Notification gating overhaul — new shared helper (`notificationGating.ts`) enforces master push toggle, per-category toggle, and quiet hours consistently across geofence enter/exit, off-campus perimeter, and on-scene arrival notifications
- On-scene arrival notification now respects the `notify_arrived_at_incident` toggle (previously fired regardless of the user's preferences)
- Quiet hours are now actually enforced on-device for local notifications — geofence, perimeter, and arrival alerts all stay silent during the configured window. Wraparound windows like 22:00 → 07:00 work correctly
- Quiet Hours UI on mobile — new section in Notification Settings with a master toggle that drops sensible defaults (10pm–7am), plus tappable Start/End cards that open an in-app time picker (no native rebuild needed)
- Self-contained TimePickerModal added to mobile (two scroll columns + 12-hour preview), so we didn't have to add `@react-native-community/datetimepicker` and force a native build
- Mobile drawer no longer freezes taps on Android — restructured so the Sign Out footer is a sticky sibling outside the scroll view, removing a flex/marginTop interaction that could leave menu items unresponsive on tall menus
- Mobile drawer now scrolls smoothly on smaller phones where the menu is taller than the viewport

---

## 2026-04-25

- Documented and locked down env variable conventions — separate `/.env` (web, `VITE_*`) and `/packages/mobile/.env` (Expo, `EXPO_PUBLIC_*` and build-time tokens) with full inline comments and `.env.example` templates for both
- Added `.windsurf/workflows/env-vars.md` rule so future Cascade sessions follow the conventions automatically
- Setup Guide screen on mobile — dedicated drawer entry that auto-detects your phone make (Xiaomi/MIUI, Samsung, Huawei, Oppo, Vivo, OnePlus, Pixel, iPhone) and shows the exact settings you need to enable for pushes and background tracking to work
- Setup Guide includes a current-state snapshot, Send-test-notification button, FAQ explaining what each permission does, and a troubleshooting section
- Notifications screen now links to the Setup Guide via a clean header card
- Push token registration auto-retries up to 5 times with exponential backoff to handle FCM cold-boot SERVICE_NOT_AVAILABLE errors
- Edge Function `send-push` deployed and live — fans out FCM (Android) + APNs (iOS) when an incident is inserted, honoring per-user preferences and tenant scoping
- Edge Function auto-disables invalid tokens (FCM 404/UNREGISTERED, APNs 410/BadDeviceToken) so stale devices stop receiving pushes
- DB trigger reads Edge URL + service-role key from Supabase Vault (encrypted at rest via pg_sodium) instead of database GUCs — no superuser permission needed
- Dynamic `app.config.js` auto-attaches Firebase service files when present, so `expo prebuild` works whether or not credentials are dropped in yet
- Hardened `.gitignore` so Firebase service-account JSON, APNs `.p8` keys, and `google-services.json` cannot be committed accidentally
- Push notifications on mobile — when an incident is reported, every team phone gets a banner instantly (FCM on Android, APNs on iOS, even when the app is closed)
- Tap a push notification → app opens directly to Live Map zoomed on the incident pin
- Auto-arrival detection — when a responder walks within 30m of an incident, status auto-flips to On Scene and the phone vibrates
- Zone enter/exit alerts — walk into or out of a zone and your phone notifies you locally
- Off-campus perimeter alert — leave the tenant home perimeter and your phone tells you
- Background location tracking — keep sharing GPS with the team while the app is closed (toggle in Notifications)
- Notification Settings screen on mobile — master toggle, granular alert types (incidents, responders, arrival, zone crossings, off-campus), background tracking, and a test-notification button
- Per-user notification preferences stored in DB — toggles persist across devices and the server respects them before fan-out
- Turn-by-turn routing on Live Map — tap Route on an incident to draw a blue polyline from your GPS to the incident (web + mobile)
- In-app navigation panel with step-by-step directions, distance, ETA, and Drive/Walk toggle (web + mobile)
- Route auto-refreshes every 30 seconds as you move
- Incidents on Live Map — pulsing red pins with severity colors (web + mobile)
- Respond to incident flow — Respond / On Scene / Cancel / Mark Resolved buttons in incident popup (web + mobile)
- Report incident by tapping on the map, searching an address, or at your current GPS — now available on both web + mobile
- Active incidents pill in web top bar and warning badge button on mobile, both with count
- Fit-all button on web + mobile maps — zooms to show every online team member, zone, and incident
- Mobile Zones management — add, edit, and delete zones directly from the phone (no longer admin-only)
- Mobile address search via Mapbox Geocoding — type a place to drop an incident there
- Google Places integration on web — address autocomplete on Branding Home Location, map search bar, and Add Zone form
- Mobile Locate Me button (flies to GPS) and Home button (flies to tenant HQ)
- Native Mapbox pulsing blue dot for the current user on mobile
- Fix tenant signup crash — chat channel membership no longer errors on missing `display_name` column
- Fix branding Home Location not persisting after Save

---

## 2026-04-23

- Add manual "Add Member" to Team page — owner/admin can create users directly with email, password, name, and role
- Add Changelog page with header shortcut icon
- Fix login crash for users without a team membership

## 2026-04-22

- Mobile crash logging system with 7-day auto-rotation
- Monorepo setup — shared packages for web + mobile with npm workspaces
- React Native Expo mobile app with drawer navigation and bottom tabs
- Mobile Dashboard, News, Alerts, and More screens
- iOS simulator build and testing
- Android emulator build and testing
- Shared hooks architecture (useAlerts, useNews, useChat) for web and mobile
- Mobile UI design system with theme, safe areas, and pull-to-refresh
