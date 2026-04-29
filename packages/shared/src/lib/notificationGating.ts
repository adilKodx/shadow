// ============================================================================
// notificationGating
//
// Small pure helpers shared between mobile and web for deciding whether a
// notification should be allowed to fire right now, given the user's
// `notification_preferences` row. Keeping them here means the gating logic
// is identical across platforms and easy to unit-test.
// ============================================================================

export interface NotificationPrefsLike {
  push_enabled: boolean;
  notify_incidents?: boolean;
  notify_incident_responders?: boolean;
  notify_zone_crossings?: boolean;
  notify_off_campus?: boolean;
  notify_arrived_at_incident?: boolean;
  quiet_start?: string | null;
  quiet_end?: string | null;
}

/**
 * Returns true if the current local time falls inside the user's quiet-hours
 * window. Quiet hours are stored as `HH:MM` strings in the user's local time;
 * either both bounds present (a window) or both empty (no quiet hours).
 *
 * Wraparound is supported: e.g. quiet_start = "22:00", quiet_end = "07:00"
 * means "between 10pm and 7am the next morning".
 */
export function isInQuietHours(
  prefs: Pick<NotificationPrefsLike, 'quiet_start' | 'quiet_end'> | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!prefs?.quiet_start || !prefs?.quiet_end) return false;
  const [sh, sm] = prefs.quiet_start.split(':').map((n) => parseInt(n, 10));
  const [eh, em] = prefs.quiet_end.split(':').map((n) => parseInt(n, 10));
  if (Number.isNaN(sh) || Number.isNaN(eh)) return false;
  const startMins = sh * 60 + (sm || 0);
  const endMins = eh * 60 + (em || 0);
  const nowMins = now.getHours() * 60 + now.getMinutes();
  if (startMins === endMins) return false;
  if (startMins < endMins) {
    // Same-day window e.g. 13:00 → 17:00
    return nowMins >= startMins && nowMins < endMins;
  }
  // Wraparound e.g. 22:00 → 07:00
  return nowMins >= startMins || nowMins < endMins;
}

/**
 * Decide whether a category-specific local notification should be allowed
 * to fire. `category` corresponds to one of the `notify_*` columns. Honors
 * the master `push_enabled` toggle and quiet hours.
 *
 * Pass `force=true` for user-triggered "send test" buttons that should
 * always go through regardless of preferences.
 */
export function shouldFireLocalNotification(
  prefs: NotificationPrefsLike | null | undefined,
  category:
    | 'incidents'
    | 'incident_responders'
    | 'zone_crossings'
    | 'off_campus'
    | 'arrived_at_incident',
  opts: { force?: boolean; now?: Date } = {},
): boolean {
  if (opts.force) return true;
  if (!prefs) return true; // default = allow when prefs not loaded yet
  if (!prefs.push_enabled) return false;
  if (isInQuietHours(prefs, opts.now)) return false;
  switch (category) {
    case 'incidents':              return prefs.notify_incidents !== false;
    case 'incident_responders':    return prefs.notify_incident_responders !== false;
    case 'zone_crossings':         return prefs.notify_zone_crossings !== false;
    case 'off_campus':             return prefs.notify_off_campus !== false;
    case 'arrived_at_incident':    return prefs.notify_arrived_at_incident !== false;
    default:                       return true;
  }
}
