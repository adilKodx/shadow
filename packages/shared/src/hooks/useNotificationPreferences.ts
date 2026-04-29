// ============================================================================
// useNotificationPreferences — read & write per-user push notification toggles
//
// Backed by the `notification_preferences` table (one row per user, scoped
// by tenant). Auto-creates a default row the first time the user opens the
// settings screen.
// ============================================================================

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export interface NotificationPreferences {
  user_id: string;
  tenant_id: string;
  push_enabled: boolean;
  notify_incidents: boolean;
  notify_incident_responders: boolean;
  notify_zone_crossings: boolean;
  notify_off_campus: boolean;
  notify_arrived_at_incident: boolean;
  quiet_start: string | null;
  quiet_end: string | null;
  updated_at: string;
}

const defaultPrefs = (userId: string, tenantId: string): NotificationPreferences => ({
  user_id: userId,
  tenant_id: tenantId,
  push_enabled: true,
  notify_incidents: true,
  notify_incident_responders: true,
  notify_zone_crossings: true,
  notify_off_campus: true,
  notify_arrived_at_incident: true,
  quiet_start: null,
  quiet_end: null,
  updated_at: new Date().toISOString(),
});

export function useNotificationPreferences() {
  const { user, tenant } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchPrefs = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) {
      console.warn('[Prefs] fetch error', error.message);
      setLoading(false);
      return;
    }
    if (!data && tenant?.id) {
      // Auto-create the default row on first open
      const fresh = defaultPrefs(user.id, tenant.id);
      const { data: inserted, error: insertErr } = await supabase
        .from('notification_preferences')
        .insert(fresh)
        .select()
        .single();
      if (insertErr) {
        console.warn('[Prefs] insert error', insertErr.message);
        setPrefs(fresh);
      } else {
        setPrefs(inserted as NotificationPreferences);
      }
    } else {
      setPrefs(data as NotificationPreferences);
    }
    setLoading(false);
  }, [user?.id, tenant?.id]);

  useEffect(() => {
    fetchPrefs();
  }, [fetchPrefs]);

  const updatePrefs = useCallback(
    async (patch: Partial<NotificationPreferences>) => {
      if (!user?.id || !prefs) return { error: 'not loaded' };
      setSaving(true);
      const optimistic = { ...prefs, ...patch };
      setPrefs(optimistic);
      const { error } = await supabase
        .from('notification_preferences')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);
      setSaving(false);
      if (error) {
        console.warn('[Prefs] update error', error.message);
        // revert
        setPrefs(prefs);
        return { error };
      }
      return { error: null };
    },
    [user?.id, prefs],
  );

  return { prefs, loading, saving, updatePrefs, refresh: fetchPrefs };
}
