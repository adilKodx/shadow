# Map Feature Testing Checklist — iOS & Android

Use this to verify the mobile map works end-to-end on both platforms.

---

## Phase 2 — Incidents on Map (Built 2026-04-25)

### Setup
1. Make sure tenant home location is set in `/branding`
2. Apply migration `00017_incident_responders.sql` if not already (`npx supabase db query --linked -f supabase/migrations/00017_incident_responders.sql`)
3. Have tracking active on mobile so GPS is fresh

### Web — Report Incident via Places Search
- [ ] Open `/map` → right sidebar → **Incidents** tab
- [ ] Type title (e.g. "Suspicious person"), pick type + severity
- [ ] Use Places search → pick an address
- [ ] Incident pin appears on map, map flies to location
- [ ] Red "1 Active" pill appears in top bar
- [ ] Incident row appears in sidebar list

### Web — Report Incident by Clicking Map
- [ ] Incidents tab → click **"Click on Map"** button
- [ ] Red banner appears: *"Click the map to drop the incident"*
- [ ] Click anywhere on map → incident dropped, banner closes

### Web — Respond Flow
- [ ] Click an incident pin → popup opens
- [ ] Click **Respond** (red button) → button changes to **On Scene** / **X**
- [ ] Popup shows "🧑 1 responding"
- [ ] Timeline update logged: `{your name} is responding`
- [ ] Click **On Scene** → `arrived_at` timestamp saved in DB
- [ ] Click the **X** (cancel) → response removed, popup shows "🧑 0 responding"

### Web — Navigate from Incident
- [ ] Incident popup → click Navigate (blue button) → Google Maps opens with directions

### Web — Mark Resolved
- [ ] Incident popup → click **Mark resolved** → pin disappears from map

### Mobile — View Incidents
- [ ] Open Live Map → red warning button in right controls has badge with count
- [ ] Tap warning button → bottom sheet lists all active incidents
- [ ] Tap an incident row → map flies to pin, popup opens at bottom

### Mobile — Respond Flow
- [ ] Tap incident pin on map → popup opens at bottom with severity-colored left border
- [ ] Tap **Respond** → button becomes **On Scene** + **X**
- [ ] Tap **On Scene** → status updates (check web — should reflect in popup)
- [ ] Tap **X** → cancels response

### Mobile — Navigate from Incident
- [ ] Popup → tap blue Navigate button → Google Maps opens

### Mobile — Report at Current Location
- [ ] Floating red **Report** button (bottom-left) → modal slides up
- [ ] Pick type + severity chips
- [ ] Tap **Report at My Location**
- [ ] New incident appears at your GPS position on map
- [ ] Map flies to the new incident
- [ ] Badge count on warning button increments

### Multi-device Sync
- [ ] Report incident on mobile → open web `/map` → pin appears without refresh
- [ ] Respond on web → mobile popup shows updated responder count

---

---

## Pre-test Setup

1. **Have an admin account with a tenant**
   - Log into web at `http://localhost:5180/login`
   - Note your tenant's home location (set in `/branding`)

2. **Seed at least 3 zones on web**
   - Go to `/map` (web)
   - Right sidebar → Zones tab → **+ Add Zone**
   - Create one of each: **Exit**, **Safe Room**, **Nursery**
   - Click "Place on Map" and drop them at different spots

3. **Have 2 devices ready**
   - Device A: your physical Android phone (logged in)
   - Device B: iOS simulator OR web browser (logged in with same or different account)

---

## Test 1 — Map Loads ✓

- [ ] Open app → sign in → tap drawer (hamburger) → **Live Map**
- [ ] Mapbox map appears (not blank white screen)
- [ ] Map centers on your tenant's home location
- [ ] Zoom level ~ 17 (building scale)
- [ ] Pan + pinch-zoom work smoothly

**If map is blank white:** Mapbox token invalid. Check `packages/mobile/.env` has `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.xxxx`.

---

## Test 2 — Location Permission ✓

- [ ] First open prompts for location permission
- [ ] Tap **Allow While Using App**
- [ ] Blue dot (user location) appears at your real position

**If no prompt appears:** Permissions may have been denied previously. Uninstall app → reinstall.

---

## Test 3 — Self Marker ✓

- [ ] My own marker shows my initials (e.g., "LS")
- [ ] Background is blue (not dark like others)
- [ ] Green "Tracking Active" pill visible at bottom-left

---

## Test 4 — Team Marker Sync ✓

- [ ] On Device B (web or other phone), enable tracking too
- [ ] Within ~10 seconds, Device B's marker appears on Device A's map
- [ ] Walk with Device A — Device B sees it move

**If not syncing:** Check Supabase → `team_locations` table → rows being inserted?

---

## Test 5 — Zone Display ✓

- [ ] All seeded zones appear on the map
- [ ] Exit zones show 🚪 emoji, red/orange color
- [ ] Safe Room shows 🛡️, green
- [ ] Nursery shows 👶, amber
- [ ] Circle zones (with radius) show a colored ring + fill

---

## Test 6 — Zone Popup + Navigation ✓

- [ ] Tap a zone pin → popup appears at bottom
- [ ] Popup shows zone name + type
- [ ] Tap **Navigate** → Google Maps opens on Android / Apple Maps on iOS
- [ ] Turn-by-turn route from your location to the zone
- [ ] Close popup with X button

---

## Test 7 — Team Member Popup ✓

- [ ] Tap another member's marker
- [ ] Popup shows their display name
- [ ] "X seconds ago" timestamp shown
- [ ] Battery % shown (if they reported it)
- [ ] **Navigate** button opens external maps

---

## Test 8 — Controls ✓

- [ ] **Locate icon** — pan map elsewhere, then tap → jumps back to tenant home
- [ ] **Refresh icon** — tap → team locations refetch immediately
- [ ] **Radio icon** (tracking toggle):
  - [ ] Tap → turns blue background → "Tracking Active" pill appears
  - [ ] Tap again → tracking stops, pill disappears

---

## Test 9 — Stats Bar ✓

- [ ] Top bar shows **X Online** (count of members within 15 min)
- [ ] **X Moving** (count of members with speed > 0.5 m/s)
- [ ] **X Exits** (count of zones with zone_type = 'exit')
- [ ] Numbers update when Device B moves / is added

---

## Test 10 — Background Behavior ✓

- [ ] With tracking on, background the app (home button)
- [ ] Wait 30 seconds, walk around
- [ ] Reopen app → your position updated
- [ ] Other members see your movement

**Note:** True background tracking (when app is killed) requires Phase 3 — not yet built.

---

## Known Issues (To Fix)

- [ ] iOS build failed initially due to `expo-file-system@55` version mismatch. Fixed by pinning to `~18.0.12`.
- [ ] No in-app turn-by-turn yet (uses native Maps app via deep link).
- [ ] Zone creation/editing not on mobile yet (web-only for now).
- [ ] Incident pins not rendered yet (Phase 2).

---

## If Something's Broken

1. **Check Metro logs** — in the terminal running `expo run:android` or `expo run:ios`
2. **Check device logs:**
   - Android: `adb logcat | grep -i shadowfield`
   - iOS: `npx react-native log-ios`
3. **Check Supabase:**
   - Tables: `team_locations`, `map_zones` should have rows
   - Auth: your session should be active
4. **Paste errors back to the assistant** — include the red lines
