// ============================================================================
// Push Notifications Service (mobile only)
//
// Handles:
//   - Permission request
//   - Native FCM (Android) / APNs (iOS) token registration via expo-notifications
//   - Persisting the token to Supabase device_tokens table
//   - Foreground notification handler (so they show as banners while app open)
//   - Tap handlers — extract incident_id from notification data and navigate
//
// We use the *device* push token (not the Expo push token) because the user
// has Firebase configured directly. On Android `getDevicePushTokenAsync()`
// returns an FCM registration token; on iOS it returns an APNs device token.
// ============================================================================

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { supabase } from '@shadowfield/shared/src/lib/supabase';

const TAG = '[Push]';

// ----------------------------------------------------------------------------
// Foreground behaviour: show a banner with sound when a notification arrives
// while the app is open. The user can override with quiet-hour preferences.
// ----------------------------------------------------------------------------
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ----------------------------------------------------------------------------
// Android requires an explicit channel for >= API 26. Run this once at boot.
// ----------------------------------------------------------------------------
export async function configureAndroidChannels() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    sound: 'default',
    lightColor: '#DC2626',
  });
  await Notifications.setNotificationChannelAsync('incidents', {
    name: 'Incidents',
    description: 'New incidents reported in your team',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 400, 200, 400],
    sound: 'default',
    lightColor: '#DC2626',
  });
  await Notifications.setNotificationChannelAsync('zones', {
    name: 'Zone alerts',
    description: 'You entered or left a zone',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
  });
}

// ----------------------------------------------------------------------------
// Ask the user for permission. Returns true if granted (or already granted).
// ----------------------------------------------------------------------------
export async function requestPushPermissions(): Promise<boolean> {
  if (!Device.isDevice) {
    console.warn(TAG, 'push notifications need a real device (simulator skipped)');
    return false;
  }

  const settings = await Notifications.getPermissionsAsync();
  let status = settings.status;
  if (status !== 'granted') {
    const ask = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowAnnouncements: true,
      },
    });
    status = ask.status;
  }
  return status === 'granted';
}

// ----------------------------------------------------------------------------
// Get the native FCM/APNs token for this device.
//
// FCM frequently returns SERVICE_NOT_AVAILABLE on cold boot while Play Services
// is still initializing. We retry with exponential backoff before giving up.
// ----------------------------------------------------------------------------
export async function getNativePushToken(): Promise<{
  token: string;
  platform: 'fcm' | 'apns';
} | null> {
  const MAX_ATTEMPTS = 5;
  let lastErr: unknown = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const result = await Notifications.getDevicePushTokenAsync();
      if (!result?.data) {
        console.warn(TAG, 'getDevicePushTokenAsync returned no token');
        return null;
      }
      const platform = Platform.OS === 'ios' ? 'apns' : 'fcm';
      console.log(
        TAG,
        `got ${platform} token (attempt ${attempt})`,
        String(result.data).slice(0, 20) + '…',
      );
      return { token: String(result.data), platform };
    } catch (err) {
      lastErr = err;
      const msg = String((err as Error)?.message || err);
      const transient = /SERVICE_NOT_AVAILABLE|TIMEOUT|Network|AUTHENTICATION/i.test(msg);
      console.warn(
        TAG,
        `getDevicePushTokenAsync failed (attempt ${attempt}/${MAX_ATTEMPTS})`,
        msg,
      );
      if (!transient || attempt === MAX_ATTEMPTS) break;
      // 1s, 2s, 4s, 8s
      await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
    }
  }

  console.warn(TAG, 'giving up on device push token', lastErr);
  return null;
}

// ----------------------------------------------------------------------------
// Register / refresh the token in the device_tokens table for this user.
// Safe to call on every login or app foreground.
// ----------------------------------------------------------------------------
export async function registerDeviceForPush(
  userId: string,
  tenantId: string,
): Promise<boolean> {
  const granted = await requestPushPermissions();
  if (!granted) {
    console.warn(TAG, 'permission not granted — skipping registration');
    return false;
  }

  const tokenResult = await getNativePushToken();
  if (!tokenResult) return false;

  const { token, platform } = tokenResult;
  const deviceLabel = `${Device.manufacturer ?? ''} ${Device.modelName ?? Device.deviceName ?? Platform.OS}`.trim();

  const { error } = await supabase
    .from('device_tokens')
    .upsert(
      {
        user_id: userId,
        tenant_id: tenantId,
        platform,
        push_token: token,
        device_label: deviceLabel,
        enabled: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,push_token' },
    );

  if (error) {
    console.warn(TAG, 'failed to upsert device_tokens', error.message);
    return false;
  }

  console.log(TAG, 'device registered', { platform, deviceLabel });
  return true;
}

// ----------------------------------------------------------------------------
// Remove this device's token on logout.
// ----------------------------------------------------------------------------
export async function unregisterDeviceForPush(userId: string): Promise<void> {
  try {
    const tokenResult = await getNativePushToken();
    if (!tokenResult) return;
    await supabase
      .from('device_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('push_token', tokenResult.token);
  } catch (err) {
    console.warn(TAG, 'unregister failed', err);
  }
}

// ----------------------------------------------------------------------------
// Robustly extract custom data from a notification.
//
// expo-notifications has a known issue under iOS Bridgeless / New Architecture
// where APNs userInfo is NOT propagated to `content.data` for server-sent
// pushes. The custom keys (incident_id, type, etc.) end up in `trigger.payload`
// alongside the `aps` system dict.
//
// We therefore try `content.data` first (works on Android + local schedules),
// then fall back to `trigger.payload` minus its `aps` key (iOS APNs path).
// ----------------------------------------------------------------------------
function extractData(notification: Notifications.Notification): Record<string, any> {
  const content = notification.request.content;
  const baseData = (content.data || {}) as Record<string, any>;
  if (Object.keys(baseData).length > 0) return baseData;

  const trigger = (notification.request as any).trigger;
  const payload = trigger?.payload;
  if (payload && typeof payload === 'object') {
    const { aps: _aps, ...custom } = payload;
    if (Object.keys(custom).length > 0) return custom;
  }
  return {};
}

// ----------------------------------------------------------------------------
// Listener wiring — return an unsubscribe function.
//
// `onTap` is called when the user taps a notification (foreground or after
// cold start). `onReceive` fires only when the app is in the foreground.
// ----------------------------------------------------------------------------
export function attachNotificationListeners(
  onTap: (data: Record<string, any>) => void,
  onReceive?: (data: Record<string, any>) => void,
) {
  const sub1 = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = extractData(response.notification);
    console.log(TAG, 'tap', { data, title: response.notification.request.content.title });
    onTap(data);
  });

  const sub2 = Notifications.addNotificationReceivedListener((notification) => {
    const data = extractData(notification);
    console.log(TAG, 'received foreground', { data, title: notification.request.content.title });
    onReceive?.(data);
  });

  // Handle the case where the app was launched by tapping a notification
  // (cold start). getLastNotificationResponseAsync returns the most recent
  // tap, even if it happened before listeners were attached.
  Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response) {
      const data = extractData(response.notification);
      console.log(TAG, 'cold-start tap', { data, title: response.notification.request.content.title });
      onTap(data);
    }
  });

  return () => {
    sub1.remove();
    sub2.remove();
  };
}
