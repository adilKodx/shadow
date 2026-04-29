// ============================================================================
// usePushNotifications hook
//
// Drop-in hook the app calls once the user is logged in. It:
//   1. Configures Android channels
//   2. Registers the device's FCM/APNs token in device_tokens for the user
//   3. Wires up tap listeners so a notification with `incident_id` deep-links
//      to the Live Map focused on that incident
// ============================================================================

import { useEffect } from 'react';
import { useAuth } from '@shadowfield/shared/src/context/AuthContext';
import {
  attachNotificationListeners,
  configureAndroidChannels,
  registerDeviceForPush,
} from '../services/pushNotifications';

type NavigateFn = (data: Record<string, any>) => void;

export function usePushNotifications(onNotificationTap: NavigateFn) {
  const { user, tenant } = useAuth();

  // Configure channels on mount (Android-only, no-op on iOS)
  useEffect(() => {
    configureAndroidChannels().catch((e) =>
      console.warn('[Push] configureAndroidChannels failed', e),
    );
  }, []);

  // Register the device token whenever we have an authenticated user+tenant
  useEffect(() => {
    if (!user?.id || !tenant?.id) return;
    registerDeviceForPush(user.id, tenant.id).catch((e) =>
      console.warn('[Push] registerDeviceForPush failed', e),
    );
  }, [user?.id, tenant?.id]);

  // Attach tap + foreground-receive listeners exactly once
  useEffect(() => {
    const unsubscribe = attachNotificationListeners(onNotificationTap);
    return unsubscribe;
  }, [onNotificationTap]);
}
