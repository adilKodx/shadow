# ShadowField Map Features

Legend: ✅ Built · 🚧 Partial · ⏳ Planned · ❌ Not started

---

## ✅ Phase 1.5 — Google Places Integration (Built)

| Feature | Where | How to Test |
|---------|-------|-------------|
| ✅ Address autocomplete search | `/branding` Home Location | Type "Saddleback Church" → pick result → lat/lng/address auto-fill. |
| ✅ Places search to jump map | `/map` top bar | Type any place → map flies there. |
| ✅ Places search to drop zone | `/map` → Zones tab → Add Zone | Type address → zone auto-created at those coords + map flies there. |
| ✅ Session tokens for billing | `PlacesAutocomplete` component | Reduces per-keystroke cost by batching into a session. |

Config: `VITE_GOOGLE_MAPS_API_KEY` in `.env`.

---

## ✅ Phase 1.6 — Mobile UX Polish (Built)

| Feature | Where | How to Test |
|---------|-------|-------------|
| ✅ Zones list bottom sheet | Mobile `/map` → list icon | Tap list icon → modal with all zones → tap one → map flies there. |
| ✅ Badge on list button | Mobile control column | Shows total zone count. |
| ✅ Locate Me button | Mobile right controls (blue locate icon) | Flies to **my GPS** (zoom 18). |
| ✅ Home button (tenant HQ) | Mobile right controls (home icon) | Flies to tenant home location. |
| ✅ Native Mapbox pulsing blue dot | Mobile map | Shows real-time OS GPS with accuracy ring. Requires precise location permission. |
| ✅ Zone debug logging | Mobile console | Logs zone count + coords on load. |

---

## ✅ Phase 1 — Core Map (Built)

### Map Display
| Feature | Web | Mobile | How to Test |
|---------|-----|--------|-------------|
| ✅ Mapbox map centered on tenant home | N/A (uses Leaflet) | ✅ | Open `/map` (web) or drawer → Live Map (mobile). Map loads centered on your org's home location. |
| ✅ Street tiles (OSM on web, Mapbox on mobile) | ✅ | ✅ | Pinch-zoom, pan — tiles load. |
| ✅ Auto-center on tenant.home_lat/lng/zoom | ✅ | ✅ | Change home location in `/branding` → reopen map → center updates. |

### GPS / Location Tracking
| Feature | Web | Mobile | How to Test |
|---------|-----|--------|-------------|
| ✅ Request location permission | ✅ | ✅ | First open shows OS prompt. |
| ✅ Get current position | ✅ | ✅ | Blue dot appears at your real location. |
| ✅ Continuous watch (5m / 10s) | ✅ | ✅ | Walk around — blue dot follows you. |
| ✅ Report location to Supabase | ✅ | ✅ | Check `team_locations` table in Supabase — new row every movement. |
| ✅ Battery level reporting | ❌ (not on web) | ✅ | Check `team_locations.battery_level` — matches phone's battery. |
| ✅ Start/Stop tracking toggle | ✅ | ✅ | Tap **radio icon** in right controls → turns green → tracking starts. |

### Team Markers
| Feature | Web | Mobile | How to Test |
|---------|-----|--------|-------------|
| ✅ Show all online members (< 15 min old) | ✅ | ✅ | Sign in on web + phone with 2 accounts → both visible. |
| ✅ Avatar with initials | ✅ | ✅ | Marker shows "LS" for "Leith Stetson". |
| ✅ "Me" distinct color (blue) | ✅ | ✅ | My marker is blue, others dark. |
| ✅ Moving indicator (green border) | ✅ | ✅ | Walking → border turns green. |
| ✅ Tap marker → popup | ✅ | ✅ | Tap → shows name, last update time, battery %. |
| ✅ Navigate button in popup | ❌ | ✅ | Tap Navigate → opens Apple/Google Maps turn-by-turn. |

### Zones
| Feature | Web | Mobile | How to Test |
|---------|-----|--------|-------------|
| ✅ Load zones from DB | ✅ | ✅ | Zones created on web appear on phone. |
| ✅ Render point zones (emoji pins) | ✅ | ✅ | Exits show 🚪, nursery shows 👶, etc. |
| ✅ Render circle zones (geofence radius) | ✅ | ✅ | Circular colored ring at zone center. |
| ✅ Tap zone → popup | ✅ | ✅ | Name + type + Navigate button. |
| ✅ Zone CRUD | ✅ | ✅ | Both: add (with name + type chips, then tap on map), edit, delete from list. |

### UI Controls
| Feature | Web | Mobile | How to Test |
|---------|-----|--------|-------------|
| ✅ Stats pills (Online / Moving / Exits) | ✅ | ✅ | Top bar shows counts that update live. |
| ✅ Recenter button | ✅ | ✅ | Tap locate icon → jumps back to tenant home. |
| ✅ Refresh button | ✅ | ✅ | Tap refresh → reloads team locations immediately. |
| ✅ Tracking toggle pill | ✅ | ✅ | "Tracking Active" banner appears when on. |

---

## ✅ Phase 2 — Incidents on Map (Built 2026-04-25)

| Feature | Web | Mobile | How to Test |
|---------|-----|--------|-------------|
| ✅ Native app navigation (Apple/Google Maps) | ✅ | ✅ | Navigate button in popups opens external maps. |
| ✅ Incident pins on map (color-coded by severity) | ✅ | ✅ | Create incident with lat/lng → pin appears; critical pulses on web. |
| ✅ Report incident — tap on map | ✅ | ✅ | Web: Incidents tab → "Click on Map". Mobile: red Report button → "Tap on Map to Place" → tap. |
| ✅ Report incident — address search | ✅ | ✅ | Web: Google Places autocomplete in Incidents tab. Mobile: "Or search an address" inside the Report modal (Mapbox Geocoding). |
| ✅ Report incident — at my current GPS | ✅ | ✅ | Both: button drops incident at your last GPS reading. |
| ✅ Fit-all button | ✅ | ✅ | Top-right controls → 👥 Users icon → zooms to fit every member, zone, and incident. |
| ✅ Mark resolved from map popup | ✅ | ✅ | Both: green "Mark Resolved" button in incident popup with confirm dialog. |
| ✅ Respond / Cancel Response | ✅ | ✅ | Tap pin → **Respond** → incident logs `{name} is responding` timeline update. |
| ✅ Status progression: enroute → onscene → cleared | ✅ | ✅ | After Respond, button becomes **On Scene**; timestamps recorded in `incident_responders`. |
| ✅ Multi-responder tracking | ✅ | ✅ | Multiple members can respond to same incident; popup shows 🧑 N responding. |
| ✅ Active incidents badge in UI | ✅ | ✅ | Web top bar red pill; Mobile warning button with count badge. |
| ✅ Route polyline between user + incident | ✅ | ✅ | Tap **Route** in incident popup → blue polyline drawn via Mapbox Directions API. |
| ✅ In-app turn-by-turn (text + polyline) | ✅ | ✅ | Bottom nav panel shows step-by-step list, distance + ETA, Drive/Walk toggle. Auto-refreshes every 30s. |

**Tables touched:** `incidents` (existing, uses `latitude/longitude/status`), `incident_responders` (new in migration `00017_incident_responders.sql`).

---

## ✅ Phase 3 — Geofencing, Background & Push Notifications (Built 2026-04-25)

| Feature | Web | Mobile | How to Test |
|---------|-----|--------|-------------|
| ✅ Push notifications (FCM Android + APNs iOS) | n/a | ✅ | Sign in → Notifications screen → grant permission → web `/map` reports an incident → push lands within seconds. |
| ✅ Tap notification → opens incident on Live Map | n/a | ✅ | Tap a push → app opens, camera flies to incident pin, popup shows. Works from cold start. |
| ✅ Auto-detect arrival at incident | ✅ (web has GPS routing already) | ✅ | Respond to an incident → walk within 30m → status auto-flips `enroute → onscene` and you get a local notification. |
| ✅ Zone enter/exit alerts | n/a | ✅ | Walk into a zone (or fake GPS) → "Entered <zone>" notification. Same on exit. Honours zone `radius_meters`, default 50m. |
| ✅ Off-campus perimeter alert | n/a | ✅ | Walk >250m from tenant home → "Off <tenant>" notification. Walk back → "Back on <tenant>". |
| ✅ Background location tracking | n/a | ✅ | Notifications screen → "Track when app is closed" → grant Always permission → close app → `team_locations` keeps receiving inserts. |
| ✅ Notification Settings screen | ⏳ | ✅ | Drawer → Notifications → master + 5 granular toggles + bg-tracking + diagnostics. |
| ✅ Per-user notification preferences | ✅ (DB ready) | ✅ | Server respects toggles before fan-out — turn off "New incidents" → you stop receiving them. |
| ✅ Tenant-scoped fan-out | n/a | ✅ | Server pushes only to device_tokens in the same tenant_id as the incident. |
| ✅ Auto-disable invalid tokens | n/a | ✅ | FCM 404/UNREGISTERED or APNs 410/BadDeviceToken auto-flips `enabled=false`. |

**Tables/code added:**
- migration `00018_push_notifications.sql` — `device_tokens`, `notification_preferences`, `notify_new_incident()` trigger
- migration `00019_push_notifications_vault.sql` — trigger reads Edge URL + service-role JWT from Supabase Vault (no superuser GUCs needed)
- Edge Function `supabase/functions/send-push/index.ts` — FCM v1 + APNs HTTP/2, deployed (active)
- Mobile services: `pushNotifications.ts` (with FCM retry/backoff), `backgroundLocation.ts`
- Mobile hooks: `usePushNotifications.ts`, `useGeofenceAlerts.ts`
- Mobile screens: `NotificationSettingsScreen.tsx`, `SetupGuideScreen.tsx`
- Mobile component: `DeviceCompatGuide.tsx` (auto-detects Xiaomi/Samsung/Huawei/Oppo/Vivo/OnePlus/Pixel/iOS)
- Shared: `useNotificationPreferences.ts`, `geo.ts` (haversine)
- Build: `app.config.js` (dynamic Firebase file detection), `.gitignore` hardened for credentials

**Setup required (one-time):** see [PUSH_SETUP.md](./PUSH_SETUP.md) for Firebase + APNs credentials and Supabase secrets.

---

## ✅ Phase 3.5 — Onboarding & Device Compatibility (Built 2026-04-25)

Phase 3 surfaced a real-world issue: many Android skins (MIUI/EMUI/ColorOS/FunTouch) silently kill background apps and FCM sockets unless the user enables vendor-specific settings. Phase 3.5 makes that discoverable.

| Feature | Mobile | How to Test |
|---------|--------|-------------|
| ✅ Setup Guide drawer entry | ✅ | Drawer → **Setup Guide** opens dedicated screen. |
| ✅ Auto-detect device manufacturer | ✅ | On Xiaomi shows MIUI steps; on Samsung shows One UI; on iPhone shows iOS guide; on unknowns shows generic Android tips. |
| ✅ Critical-step badges | ✅ | Required steps marked with red "Required" pill so users know what's mandatory vs optional. |
| ✅ Deep link to device settings | ✅ | "Open device settings" button uses `Linking.openSettings()` — jumps directly to Settings → Apps → ShadowField. |
| ✅ Acknowledgement state | ✅ | "I've completed these steps" → persisted in AsyncStorage; collapses card on next visit. |
| ✅ Status snapshot | ✅ | Shows device, platform, current notification permission with color-coded value. |
| ✅ FAQ + troubleshooting | ✅ | Expandable rows explaining each permission and what to do if pushes don't arrive / arrive late / zone alerts fail. |
| ✅ Send test notification | ✅ | Local-only test that bypasses server — proves OS permission. |

**Code added:**
- `packages/mobile/src/screens/SetupGuideScreen.tsx`
- `packages/mobile/src/components/DeviceCompatGuide.tsx` (vendor map + step rendering)

---

## ✅ Phase 3.7 — Realtime, Background Reliability & Quiet Hours (Built 2026-04-26)

This phase plugs three gaps surfaced during real-world testing of Phase 3:
the live map was polling instead of streaming, background GPS was silently
broken on mobile, and quiet-hour preferences existed in the DB but weren't
enforced or settable from the UI.

### Realtime live map
| Feature | Web | Mobile | How to Test |
|---------|-----|--------|-------------|
| ✅ Realtime publication for `member_locations`, `incidents`, `incident_responders`, `map_zones` | ✅ | ✅ | Move on phone A → phone B sees the marker reposition within ~1s. Report an incident on web → mobile pin appears within ~1s. |
| ✅ `REPLICA IDENTITY FULL` on those tables | ✅ | ✅ | UPDATE/DELETE realtime events now reliably reach RLS-filtered subscribers (previously some updates were dropped). |
| ✅ `useMap` subscribes to `member_locations` changes | ✅ | ✅ | `useMap.ts` channel `map:<tenant_id>` updates without the 10s poll fallback. Poll kept as safety net only. |

### Background location reliability
| Feature | Mobile | How to Test |
|---------|--------|-------------|
| ✅ Background task writes via `report_member_location` RPC (was inserting to non-existent `team_locations`) | ✅ | Enable "Track when app is closed" → close app → walk → `member_locations` keeps receiving inserts with `source` markers. |
| ✅ Display name stashed in AsyncStorage so cold-start task has it | ✅ | Reboot phone → first background tick still records the user's name correctly. |

### Notification gating + Quiet Hours
| Feature | Web | Mobile | How to Test |
|---------|-----|--------|-------------|
| ✅ Shared `shouldFireLocalNotification(prefs, category)` helper | n/a | ✅ | All local notifications (zone, perimeter, arrival) go through the same gate — `push_enabled` + per-category toggle + quiet hours. |
| ✅ On-scene arrival respects `notify_arrived_at_incident` | n/a | ✅ | Disable the toggle → walk to incident → status auto-flips to onscene **silently**. Re-enable → notification returns. |
| ✅ Quiet Hours **enforced** on-device | n/a | ✅ | Set 22:00 → 07:00 → walk into a zone at 23:00 → no notification. Walk out at 08:00 → notification fires. |
| ✅ Quiet Hours UI in Notification Settings | ⏳ | ✅ | Drawer → Notifications → "Quiet hours" section. Toggle on → defaults `10:00 PM – 7:00 AM`. Tap Start/End → in-app time picker (hour + minute). |
| ✅ Wraparound windows (e.g. 22:00 → 07:00) | n/a | ✅ | Both 23:30 and 03:00 fall inside the window correctly. |

**Files added/changed:**
- migration `00020_live_map_realtime.sql`
- `packages/shared/src/lib/notificationGating.ts` — `isInQuietHours()` + `shouldFireLocalNotification()`
- `packages/mobile/src/hooks/useMap.ts` — realtime subscription
- `packages/mobile/src/services/backgroundLocation.ts` — switched to RPC, stash display_name
- `packages/mobile/src/hooks/useGeofenceAlerts.ts` — uses gating helper
- `packages/mobile/src/screens/MapScreen.tsx` — arrival notification gated
- `packages/mobile/src/screens/NotificationSettingsScreen.tsx` — Quiet Hours UI + `TimePickerModal`
- `packages/mobile/src/navigation/DrawerNav.tsx` — sticky footer + Android scroll fix

---

## ⏳ Phase 4 — Advanced Map (Future)

| Feature | Status | Notes |
|---------|--------|-------|
| ⏳ Heatmap (activity density) | ⏳ | Mapbox heatmap layer over `team_locations`. |
| ⏳ Breadcrumb trail (last 30 min) | ⏳ | Store history, draw polyline behind each member. |
| ⏳ Floor plan overlays | 🚧 DB ready | `map_overlays` table exists. Need mobile render + admin upload UI. |
| ⏳ Indoor floor auto-detection | 🧠 Design locked | Barometer + entrance-zone self-calibration + accel fusion. No manual entry. See [`FLOOR_DETECTION.md`](./FLOOR_DETECTION.md) — parked, ~4-5 days to build when we pick it up. |
| ⏳ Marker clustering when zoomed out | ⏳ | For campuses with many members — supercluster on web, Mapbox cluster on mobile. |
| ⏳ Offline map tiles | ⏳ | Mapbox offline regions for events with poor coverage. |
| ⏳ Panic button + live share | ⏳ | Broadcast continuous GPS + audio to all members for N minutes. |
| ⏳ Camera positions on map | ⏳ | Tap camera → view live feed. Needs `cameras` table + RTSP/WebRTC bridge. |
| ⏳ ETA calculation in popup | ⏳ | Currently shown only on Route panel — also surface inline in incident popup. |
| ⏳ Multi-stop routing | ⏳ | Visit Zone A → Zone B → Incident in one route. |

---

## ⏳ Phase 4.5 — Notification Polish (Future)

| Feature | Status | Notes |
|---------|--------|-------|
| 🚧 Quiet hours | 🚧 Client done | Mobile UI ships in Phase 3.7 and **client-side local notifications honor it**. Server-side `send-push` does **not** yet — needs a `timezone` column on `notification_preferences` so the Edge Function can compare against the user's local time. |
| ⏳ Custom incident sounds per severity | ⏳ | Critical = siren, high = alert, medium = ping. |
| ⏳ Action buttons on push | ⏳ | "Respond" / "Decline" buttons directly on the notification banner. |
| ⏳ Group notifications by incident | ⏳ | Multiple updates collapse into a single threaded notification. |
| ⏳ Web push (browser notifications) | ⏳ | Service worker + `Notification API` so web users get banners too. |
| ⏳ SMS fallback for critical | ⏳ | If a user's phone is offline, SMS via Twilio after 60s. |
| ⏳ Admin "broadcast" notification | ⏳ | Send arbitrary push to whole tenant from `/team` page. |

---

## Quick Dev Test (End-to-End)

1. Sign in on **web** (`/map`) + **Android phone** using **2 different accounts**
2. Enable tracking on both
3. See both markers appear on both screens
4. On web: add a zone (e.g., "Front Door" → Exit type) by clicking map
5. Reopen map on phone → zone appears as 🚪 pin
6. Tap the pin → popup → **Navigate** → Google Maps opens with directions
7. Walk outside — your marker updates on both devices
