// ============================================================================
// Background location tracking
//
// Uses expo-task-manager + expo-location to keep streaming GPS to Supabase
// `member_locations` (via the `report_member_location` RPC) even when the app
// is backgrounded or terminated. Requires
// "Always" location permission — the app prompts the user the first time
// `startBackgroundTracking()` is called.
//
// On iOS we also use significant-change updates which are battery-friendly;
// on Android we run a foreground service to satisfy ACCESS_BACKGROUND_LOCATION
// requirements.
// ============================================================================

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@shadowfield/shared/src/lib/supabase';

const BG_LOCATION_TASK = 'shadowfield-background-location';
const STORAGE_USER_KEY = '@sf:bg_user_id';
const STORAGE_TENANT_KEY = '@sf:bg_tenant_id';
const STORAGE_DISPLAY_NAME_KEY = '@sf:bg_display_name';

// ────────────────────────────────────────────────────────────────────────────
// Task definition — must be registered at module load time, BEFORE any task
// can run. We read the user/tenant ids out of AsyncStorage because the JS
// engine may be cold-starting from a background event without a React tree.
// ────────────────────────────────────────────────────────────────────────────
TaskManager.defineTask(BG_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('[BG] task error', error);
    return;
  }
  const { locations } = (data as any) || {};
  if (!locations || locations.length === 0) return;

  try {
    const [userId, tenantId, displayName] = await Promise.all([
      AsyncStorage.getItem(STORAGE_USER_KEY),
      AsyncStorage.getItem(STORAGE_TENANT_KEY),
      AsyncStorage.getItem(STORAGE_DISPLAY_NAME_KEY),
    ]);
    if (!userId || !tenantId) {
      console.warn('[BG] no stored user/tenant — skipping report');
      return;
    }

    const last = locations[locations.length - 1];
    const { latitude, longitude, accuracy, altitude, speed, heading } = last.coords ?? {};
    if (latitude == null || longitude == null) return;

    // Use the same RPC as the foreground watcher (`report_member_location`)
    // so we hit `member_locations` consistently, including the `is_moving`
    // derivation and SECURITY DEFINER write path. Previously this function
    // inserted into a non-existent `team_locations` table and every write
    // silently failed.
    const { error: rpcErr } = await supabase.rpc('report_member_location', {
      p_tenant_id: tenantId,
      p_user_id: userId,
      p_display_name: displayName ?? 'Team Member',
      p_latitude: latitude,
      p_longitude: longitude,
      p_accuracy: accuracy ?? null,
      p_altitude: altitude ?? null,
      p_heading: heading ?? null,
      p_speed: speed ?? null,
      p_battery_level: null,
    });
    if (rpcErr) {
      console.warn('[BG] report_member_location error', rpcErr.message);
    } else {
      console.log('[BG] reported location', { latitude, longitude });
    }
  } catch (err) {
    console.warn('[BG] unexpected error', err);
  }
});

export async function startBackgroundTracking(
  userId: string,
  tenantId: string,
  displayName: string = 'Team Member',
): Promise<boolean> {
  // Request foreground first, then background
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') {
    console.warn('[BG] foreground permission not granted');
    return false;
  }
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== 'granted') {
    console.warn('[BG] background permission not granted');
    return false;
  }

  // Stash identifiers so the task body can read them on cold start
  await AsyncStorage.setItem(STORAGE_USER_KEY, userId);
  await AsyncStorage.setItem(STORAGE_TENANT_KEY, tenantId);
  await AsyncStorage.setItem(STORAGE_DISPLAY_NAME_KEY, displayName);

  const isRegistered = await TaskManager.isTaskRegisteredAsync(BG_LOCATION_TASK);
  if (isRegistered) {
    console.log('[BG] already tracking');
    return true;
  }

  await Location.startLocationUpdatesAsync(BG_LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 30_000,        // sample every 30s when moving
    distanceInterval: 25,        // or every 25m of movement
    deferredUpdatesInterval: 60_000,
    deferredUpdatesDistance: 50,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'ShadowField is tracking your location',
      notificationBody: 'Sharing your position with the security team.',
      notificationColor: '#1d4ed8',
    },
    pausesUpdatesAutomatically: false,
  });

  console.log('[BG] started');
  return true;
}

export async function stopBackgroundTracking(): Promise<void> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(BG_LOCATION_TASK);
  if (!isRegistered) return;
  await Location.stopLocationUpdatesAsync(BG_LOCATION_TASK);
  console.log('[BG] stopped');
}

export async function isBackgroundTrackingActive(): Promise<boolean> {
  return TaskManager.isTaskRegisteredAsync(BG_LOCATION_TASK);
}
