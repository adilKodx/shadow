# Floor Detection (Indoor Positioning)

**Status:** 🧠 Design locked, build deferred
**Owner:** TBD
**Last updated:** 2026-04-27

> Parked while we focus on other priorities. Everything needed to resume is here.
> When picking this up, start with Phase 1 in the [Build plan](#build-plan).

---

## The problem in one sentence

If two guards are standing next to each other and one walks 20m down the road
while the other climbs to the 3rd floor, **plain GPS shows both at the same
lat/lng** — horizontal distance is identical to vertical distance to GPS, and
GPS altitude accuracy is too poor (±15-30m) to distinguish floors.

We need the Live Map to show the road-walker as `30m away outside` and the
stair-climber as `3 floors above (same area)` — **without the user tapping
anything**.

---

## Non-negotiable UX principle

**No manual floor entry as primary input.** Security guards have their hands
full. The app must auto-detect. A one-tap manual override exists only as a
correction mechanism, and corrections feed back into auto-calibration so the
system self-heals over time.

---

## The architecture (sensor fusion, zero hardware cost)

Every modern phone already ships the sensors we need. We combine three signals
plus our existing geofences:

| Signal | What it tells us | Source | On every phone? |
|--------|------------------|--------|-----------------|
| **Barometer** (atmospheric pressure) | Altitude change (~12 Pa ≈ 1 floor) | `expo-sensors` Barometer API | ✅ iPhone 6+, modern Android |
| **Accelerometer + gyro** | Stair rhythm, elevator acceleration | `expo-sensors` Accelerometer | ✅ Yes |
| **GPS signal quality** | "Just entered/left a building" | Existing GPS watcher | ✅ Yes |
| **Entrance-tagged zones** | "This door = ground floor of Building A" | Our existing `map_zones` + new `is_entrance` flag | ✅ Already built |

This is exactly how **Google Indoor Maps** and **Apple Indoor** work in
production. We are not inventing anything novel.

---

## The weather-drift problem and how we solve it

The one real barometer weakness: atmospheric pressure shifts with weather. A
rainstorm can shift it by 2-3 floors' worth over a day. We solve this with
**self-calibrating entrance zones**:

1. Admin drops a small zone on each main building entrance (one-time, 30s).
2. Every time any team member walks through that zone, their phone writes
   their current pressure reading to `building_pressure_baselines` as
   "Building A's ground floor right now".
3. That baseline is rolling — refreshed continuously by every entrance
   crossing, so a guard who's been inside for 4 hours stays correct because
   someone else just recalibrated it 30 seconds ago.
4. Floor for any guard = `(baseline - current_pressure) / 12 Pa`.

**Result:** weather drift is eliminated without any conscious calibration
step. Manual recalibration never exists.

---

## UX storyboard — what the guard experiences

| # | Guard action | What the app shows | What runs underneath |
|---|--------------|--------------------|----------------------|
| 1 | Opens app in parking lot | Marker on lot, no floor badge | GPS strong, outdoor mode |
| 2 | Walks toward main door | Marker follows | GPS still primary |
| 3 | Crosses entrance zone | Marker gets `🏢 G` badge | Barometer baseline captured, mode → indoor |
| 4 | Stairs up to floor 2 | Badge flips to `L2` | Barometer detects ~24 Pa drop; accel confirms 14 stair steps → commit |
| 5 | Walks east hallway on L2 | Marker moves horizontally on the L2 overlay | Barometer stable; last GPS fix extrapolated |
| 6 | Elevator down to basement | Badge drops through L1, G, lands `B1` | Barometer rise ~36 Pa; accel sees elevator pattern (not stairs) |
| 7 | Exits main door | Badge gone, outdoor marker | GPS reacquires, baseline resets |

**Guard never touched a floor button.**

---

## UX on the dispatcher side

The web Live Map already has a floor switcher (shipped 2026-04-26). Once
members carry a `floor_level`, the switcher also filters **markers**:

- Switcher set to `L3` → only see team members on L3 + L3 overlays
- Switcher set to `All` → see everyone with floor badges on their pins
- Team panel auto-groups: `2 inside Building A (G: 0, L2: 1, L3: 1), 3 outside`

This answers the original scenario cleanly:

> Before: "Ali and John are both at the same spot. Which one is on the 3rd floor?"
> After: `Ali 🏢 L3 · 30s ago` vs `John 🛣 outside · 10s ago`

---

## Accuracy expectations

| Scenario | Expected accuracy |
|---|---|
| Modern iPhone (6+) | ±0 floor |
| Modern Android flagship (Pixel, Samsung S/A, OnePlus, etc.) | ±0 floor |
| Budget Android without barometer | ±1 floor (accel-only stair counting) |
| Fast high-rise elevator | ±1 floor briefly (settles in 2-3s at stop) |
| Just after a thunderstorm, no recent entrance crossing | ±2-3 floors (worst case — solved by entrance calibration) |
| Multi-level parking garages | Intentionally disabled in those zones |

Google's published indoor team stats: **~99% floor-correct** across thousands
of buildings with this exact architecture. We aim to match, not beat.

---

## Failure modes and graceful degradation

| Problem | What the app does |
|---|---|
| Low confidence for 60s | Floor badge shows `L2?` in amber — "probably L2, verify" |
| Wrong floor detected (rare) | Tap own marker → compact floor picker shows as correction (not primary input). One tap fixes + recalibrates |
| Phone has no barometer | Fall back to "inside Building A" without specific floor. Still better than nothing |
| First tenant run, no entrance zones configured | Dispatcher sees one-time prompt: "Tap the front door of your main building to enable floor detection." ~30s onboarding |
| Guard wanders between two buildings | Whichever entrance zone they crossed last wins — handles overlapping bubbles gracefully |
| Barometer itself fails / returns 0 | Silently degrade to GPS-only, log telemetry, keep tracking working |

**Design contract:** the amber `?` indicator says "verify before dispatching
critical resources." Never promise precision we can't deliver.

---

## UX decisions that must be locked in before build

These are the only open product questions — everything else is engineering.

### 1. What to show when confidence is low?

- ✅ **Chosen:** Show best guess with amber `?` indicator.
- Rejected: "Show nothing when unsure." Security dispatchers prefer "probably L2" over "unknown" in almost every scenario.

### 2. What to show mid-transition (guard in the staircase)?

- ✅ **Chosen:** Stay at last confirmed floor until transition commits. Avoids flicker.
- Rejected: Live `L1↑L2` animation — visually noisy and a mid-staircase marker isn't operationally useful.

### 3. Where does the floor badge live on the marker?

- ✅ **Chosen:** Small badge in the bottom-right corner of the existing marker bubble. Only shown when floor is known.
- Alternative considered: replacing the marker icon entirely — rejected because it breaks marker recognizability.

### 4. How many seconds of barometer agreement before we commit a floor change?

- ✅ **Chosen:** 3 consecutive samples with >10 Pa delta + accel rhythm match.
- Tune after first real-world test.

---

## Schema changes needed

### Migration 1 — member floor tracking

```sql
ALTER TABLE member_locations
  ADD COLUMN floor_level INT,           -- 0 ground, 1 up, -1 basement, NULL outdoor/unknown
  ADD COLUMN pressure_hpa NUMERIC(7,2), -- raw barometer reading
  ADD COLUMN floor_confidence SMALLINT; -- 0 (low) ... 100 (high)
```

### Migration 2 — entrance-tagged zones

```sql
ALTER TABLE map_zones
  ADD COLUMN is_entrance BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN building_id UUID;          -- groups multi-entrance buildings

CREATE INDEX idx_zones_entrance ON map_zones(tenant_id, is_entrance) WHERE is_entrance;
```

### Migration 3 — self-calibrating pressure baselines

```sql
CREATE TABLE building_pressure_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  building_id UUID NOT NULL,            -- matches map_zones.building_id
  ground_pressure_hpa NUMERIC(7,2) NOT NULL,
  last_updated_by UUID,                 -- member who last calibrated
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  sample_count INT DEFAULT 1            -- rolling average smooths single-reading noise
);
CREATE INDEX idx_baselines_building ON building_pressure_baselines(tenant_id, building_id);
```

### RPC: `calibrate_building_pressure(building_id, pressure_hpa)`

Called from mobile every time a guard crosses an entrance zone. Upserts a
rolling average with an exponential decay so old readings fade out over ~1
hour.

---

## Build plan

Total estimate: **~4-5 days** of focused work.

| Phase | Scope | Time | Value milestone |
|---|---|---|---|
| **1. Foundation: schema + raw barometer capture** | Migrations 1-3. Mobile reads barometer every GPS tick, writes `pressure_hpa` (no floor inference yet) | 1 day | Real data flowing to analyze |
| **2. Entrance zones** | `is_entrance` flag, admin UI (zones sidebar gets a toggle), `calibrate_building_pressure` RPC, mobile hook calls it when crossing an entrance zone | 1 day | Calibration working |
| **3. Floor inference** | Client-side function: `floor = round((baseline - current) / 12)`. Write inferred `floor_level` + `floor_confidence`. Display badge on marker | 0.5 day | Guards' phones start publishing floor |
| **4. Dispatcher UX on map** | Marker floor badge, floor switcher filters markers (not just overlays), team panel groups by floor | 0.5 day | Users actually see the feature |
| **5. Accelerometer sanity check** | Stair classifier + elevator classifier, fuse with barometer. Boost `floor_confidence` when both agree | 1 day | Accuracy bump, amber → green more often |
| **6. One-tap correction** | Tap own marker → 4-button floor picker → fixes display + recalibrates local baseline | 0.5 day | Self-healing UX |

Ship order rationale: 1→2→3 is the **minimum viable feature**. Ship it. 4 is
the dispatcher UI. 5 is the accuracy polish. 6 is the safety net for bad
readings.

---

## Reference implementations to study when we pick this up

- **Google Indoor Maps whitepaper** — documents the barometer + WiFi fingerprinting + accel fusion approach
- **Apple CoreLocation `CLFloor`** — iOS exposes a pre-computed floor for you via Apple's indoor SDK (works only in Apple-mapped buildings — useful for benchmarks, not runtime)
- **Indoor Survey app (Apple)** — free on the App Store, shows what data Apple captures when surveying a building
- **Titan HST** — closest competitor with a floor-plan product, worth screenshotting
- **Mappedin demo app** — paid indoor-maps SaaS, best-in-class polish

---

## Libraries / packages we'll need

| Purpose | Package | Notes |
|---|---|---|
| Barometer readings on mobile | `expo-sensors` (already installed) | `Barometer.addListener(...)` — needs no prebuild |
| Accelerometer / gyro | `expo-sensors` | Same package |
| Low-pass filter for pressure noise | Custom 5-sample moving average | Trivial, no lib needed |
| Stair-step classifier | Custom peak detector on accel Z-axis | ~50 lines, no ML needed |
| Elevator classifier | Threshold on sustained vertical accel | ~30 lines |

No new native dependencies. No prebuild / EAS rebuild required.

---

## Testing plan

1. **Unit tests** — floor inference math (synthetic pressure streams)
2. **Accelerometer fixtures** — recorded traces of stair climb, elevator ride, flat walking; replay through classifier
3. **Real-world script** — documented walkthrough with a 3-story building: park outside, enter, stairs to L3, elevator to B1, exit. Record expected floor at each checkpoint
4. **Regression** — save real pressure traces from each test phone; replay in CI to catch regressions in the classifier

---

## Known future enhancements (post-v1)

These are NOT in the build plan above, but parked here so we don't lose them:

- **WiFi fingerprinting** — adds redundancy, requires passive site learning. iOS restricts scanning heavily, Android varies. Only worth it for large campuses
- **BLE beacons** — hardware cost but near-perfect accuracy. Offer as a premium tier for high-security tenants
- **UWB** (iPhone 11+ / Galaxy S21+) — centimeter-level indoor. Requires UWB anchors. Premium hardware kit for enterprise
- **Anchor to known floor plan coordinate** — when an overlay is placed, we know its lat/lng bbox; if we know the guard's floor + marker lat/lng, we can resolve "which room" (e.g. "Sanctuary west aisle") by pointing into the overlay's room polygons. Huge value-add, needs per-floor room polygons
- **Historical floor breadcrumb** — "guard spent 8 min on L3, 2 min on L2, 5 min on L1" — compliance + incident reconstruction
- **Heatmaps per floor** — where does the team spend time?

---

## Decision log

| Date | Decision | Rationale |
|---|---|---|
| 2026-04-27 | Park build, lock design | Other priorities. Design is solid; resume point is Phase 1 |
| 2026-04-27 | Reject manual-first floor entry | Guards' hands are busy. Manual exists only as correction |
| 2026-04-27 | Barometer + entrance calibration as primary | Industry-standard, zero new hardware, works on existing fleet |
| 2026-04-27 | Show best-guess-with-amber when uncertain | Useful > precise in a security context |
