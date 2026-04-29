// ============================================================================
// useGeofenceAlerts
//
// Foreground-only geofence watcher for the mobile Live Map. Fires *local*
// notifications when:
//   • the user enters or leaves a zone
//   • the user leaves the tenant home perimeter ("off-campus")
//
// Background equivalents (when the app is closed) live in `backgroundLocation.ts`
// using expo-task-manager. This hook handles the simpler in-app case so users
// see the alerts immediately while looking at the map.
// ============================================================================

import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { distanceMeters } from '@shadowfield/shared/src/lib/geo';
import { useNotificationPreferences } from '@shadowfield/shared/src/hooks/useNotificationPreferences';
import { useAuth } from '@shadowfield/shared/src/context/AuthContext';
import { shouldFireLocalNotification } from '@shadowfield/shared/src/lib/notificationGating';
import type { MapZone } from './useMap';

const DEFAULT_ZONE_RADIUS_M = 50;
const OFF_CAMPUS_RADIUS_M = 250; // tenant home perimeter
// Hysteresis band — you must be this far past the boundary before a transition
// counts. Prevents GPS jitter (typical indoor drift 10-30m) from spamming the
// user with enter/exit notifications while standing still.
const ZONE_HYSTERESIS_M = 15;

interface MyLocation {
  lat: number;
  lng: number;
}

export function useGeofenceAlerts(
  myLocation: MyLocation | null,
  zones: MapZone[],
) {
  const { tenant } = useAuth();
  const { prefs } = useNotificationPreferences();

  // Zones the user is currently inside (by id) — used to detect transitions.
  // Null means "not initialised yet" so we can seed on the first reading
  // without firing a bogus "Entered" notification for zones the user was
  // already standing in when the screen mounted.
  const insideZonesRef = useRef<Set<string> | null>(null);
  // Whether the user is currently inside the tenant perimeter
  const insideCampusRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (!myLocation || !prefs) return;

    // ── 1. Per-zone enter/exit ─────────────────────────────────────────────
    if (shouldFireLocalNotification(prefs, 'zone_crossings')) {
      const prev = insideZonesRef.current;
      const nowInside = new Set<string>();
      for (const z of zones) {
        if (z.center_lat == null || z.center_lng == null) continue;
        const radius = z.radius_meters ?? DEFAULT_ZONE_RADIUS_M;
        const d = distanceMeters(myLocation, { lat: Number(z.center_lat), lng: Number(z.center_lng) });
        const wasInside = prev?.has(z.id) ?? false;
        // Hysteresis: tighter threshold to enter, looser to leave. Prevents
        // GPS jitter from flipping the same zone enter/exit while stationary.
        const enterThreshold = Math.max(0, radius - ZONE_HYSTERESIS_M);
        const exitThreshold = radius + ZONE_HYSTERESIS_M;
        if (wasInside) {
          if (d <= exitThreshold) nowInside.add(z.id);
        } else {
          if (d <= enterThreshold) nowInside.add(z.id);
        }
      }

      if (prev === null) {
        // First reading after mount — seed state without firing notifications
        // for zones the user was already inside when the screen opened.
        insideZonesRef.current = nowInside;
      } else {
        // Entered zones (not previously inside)
        nowInside.forEach((id) => {
          if (!prev.has(id)) {
            const z = zones.find((zz) => zz.id === id);
            if (z) fireZoneNotification(z, 'enter');
          }
        });
        // Exited zones (previously inside)
        prev.forEach((id) => {
          if (!nowInside.has(id)) {
            const z = zones.find((zz) => zz.id === id);
            if (z) fireZoneNotification(z, 'exit');
          }
        });
        insideZonesRef.current = nowInside;
      }
    }

    // ── 2. Off-campus perimeter ────────────────────────────────────────────
    if (
      shouldFireLocalNotification(prefs, 'off_campus') &&
      tenant?.home_lat &&
      tenant?.home_lng
    ) {
      const d = distanceMeters(myLocation, {
        lat: Number(tenant.home_lat),
        lng: Number(tenant.home_lng),
      });
      const insideCampus = d <= OFF_CAMPUS_RADIUS_M;
      if (insideCampusRef.current === null) {
        // First reading after boot — initialise without firing
        insideCampusRef.current = insideCampus;
      } else if (insideCampusRef.current && !insideCampus) {
        firePerimeterNotification('exit', tenant.name);
        insideCampusRef.current = false;
      } else if (!insideCampusRef.current && insideCampus) {
        firePerimeterNotification('enter', tenant.name);
        insideCampusRef.current = true;
      }
    }
  }, [myLocation?.lat, myLocation?.lng, zones, prefs, tenant]);
}

async function fireZoneNotification(zone: MapZone, direction: 'enter' | 'exit') {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: direction === 'enter' ? `Entered ${zone.name}` : `Left ${zone.name}`,
        body:
          direction === 'enter'
            ? `You're now inside the ${zone.zone_type} zone.`
            : `You've left the ${zone.zone_type} zone.`,
        data: { type: 'zone_crossing', zone_id: zone.id, direction },
        sound: 'default',
      },
      trigger: null,
    });
  } catch (e) {
    console.warn('[Geofence] zone notification failed', e);
  }
}

async function firePerimeterNotification(direction: 'enter' | 'exit', tenantName?: string | null) {
  const label = tenantName || 'campus';
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: direction === 'exit' ? `Off ${label}` : `Back on ${label}`,
        body:
          direction === 'exit'
            ? 'You have left the home perimeter.'
            : 'You have returned to the home perimeter.',
        data: { type: 'off_campus', direction },
        sound: 'default',
      },
      trigger: null,
    });
  } catch (e) {
    console.warn('[Geofence] perimeter notification failed', e);
  }
}
