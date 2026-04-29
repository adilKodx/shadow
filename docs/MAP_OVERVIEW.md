# ShadowField Live Map — Overview

## Purpose

The Live Map is the operational heart of ShadowField. It shows a security team's real-time positions, pre-defined zones (exits, safe rooms, restricted areas, etc.), and active incidents — all synced live across every device (web + iOS + Android).

---

## How It Works (High Level)

```
┌──────────────────────┐          ┌──────────────────────┐
│  Member's Phone      │          │  Command Dashboard   │
│                      │          │  (web + mobile)      │
│  GPS → expo-location │──┐    ┌──│  See everyone        │
│  Battery → expo-bat  │  │    │  │  React to incidents  │
│  Map → @rnmapbox/maps│  │    │  │                      │
└──────────────────────┘  │    │  └──────────────────────┘
                          ▼    │
              ┌───────────────────────┐
              │ Supabase (Postgres +  │
              │  Realtime + RPCs)     │
              │  • team_locations     │
              │  • map_zones          │
              │  • incident_reports   │
              └───────────────────────┘
```

Every 5 meters of movement (or every 10 seconds) each phone calls the `report_member_location` RPC, which updates a row in `team_locations`. Every other client polls or subscribes and re-renders markers.

---

## Platforms

| Platform | Map Library | GPS | Status |
|----------|-------------|-----|--------|
| Web      | Leaflet + react-leaflet | `navigator.geolocation` | ✅ Built (see `src/pages/LiveMap.tsx`) |
| iOS      | @rnmapbox/maps | expo-location | 🚧 In progress |
| Android  | @rnmapbox/maps | expo-location | 🚧 In progress |

---

## Key Files

### Web
- `src/pages/LiveMap.tsx` — Main map page
- `src/hooks/useMap.ts` — Data fetching, location reporting

### Mobile
- `packages/mobile/src/screens/MapScreen.tsx` — Main mobile map
- `packages/mobile/src/hooks/useMap.ts` — Mobile version (uses `expo-location` instead of `navigator.geolocation`)
- `packages/mobile/app.json` — Mapbox + location permission config plugins

### Database
- `supabase/migrations/*_maps.sql` — `map_zones`, `map_overlays`, `team_locations` tables
- RPCs: `get_team_locations`, `report_member_location`

---

## The 3 Data Models

### 1. Tenant Home (Campus Center)
Lives in `tenants` table:
- `home_lat`, `home_lng` — default map center
- `home_zoom` — default zoom (17 = building scale)
- Set via `/branding` page on web

### 2. Map Zones
Defined per tenant — exits, entrances, restricted areas, safe rooms, nurseries, etc.

| Field | Purpose |
|-------|---------|
| `zone_type` | exit / entrance / building / parking / restricted / safe_room / stage / nursery / playground / custom |
| `shape_type` | point / circle / polygon |
| `center_lat / center_lng` | for point & circle zones |
| `radius_meters` | for circle (geofence radius) |
| `polygon_coords` | JSON array for polygon shapes |
| `color`, `icon` | visual display |
| `floor_level` | multi-floor buildings |

### 3. Team Locations (Live)
Written continuously while tracking is on:

| Field | Purpose |
|-------|---------|
| `user_id` | Who |
| `latitude, longitude` | Where |
| `speed, heading` | Direction + m/s |
| `is_moving` | Derived (speed > 0.5 m/s) |
| `battery_level` | Phone battery % |
| `recorded_at` | When |
| `accuracy` | GPS accuracy in meters |

---

## Related Docs

- `MAP_LIBRARIES.md` — Why we picked Mapbox vs Google vs Apple
- `MAP_FEATURES.md` — Full feature list + test checklist
- `MAP_MOBILE_SETUP.md` — How the mobile app was set up, build steps
- `MAP_TESTING.md` — Verification steps for iOS + Android
