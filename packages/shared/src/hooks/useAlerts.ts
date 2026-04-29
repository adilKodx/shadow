import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { encryptMessage, decryptMessage } from '../lib/encryption';

export interface Alert {
  id: string;
  tenant_id: string;
  title: string;
  message: string;
  alert_type: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  target_all: boolean;
  target_roles: string[] | null;
  image_url: string | null;
  is_active: boolean;
  expires_at: string | null;
  acknowledged_count: number;
  created_by: string | null;
  created_by_name: string | null;
  is_encrypted: boolean;
  created_at: string;
  updated_at: string;
  is_acknowledged?: boolean;
}

export interface AlertAcknowledgment {
  id: string;
  alert_id: string;
  user_id: string;
  user_name: string | null;
  acknowledged_at: string;
}

export const ALERT_TYPES = [
  { value: 'emergency', label: 'Emergency', color: 'bg-red-600 text-white', icon: 'Siren' },
  { value: 'warning', label: 'Warning', color: 'bg-amber-500 text-white', icon: 'AlertTriangle' },
  { value: 'info', label: 'Information', color: 'bg-blue-500 text-white', icon: 'Info' },
  { value: 'all_clear', label: 'All Clear', color: 'bg-green-500 text-white', icon: 'CheckCircle' },
  { value: 'lockdown', label: 'Lockdown', color: 'bg-red-900 text-white', icon: 'Lock' },
  { value: 'evacuation', label: 'Evacuation', color: 'bg-orange-600 text-white', icon: 'LogOut' },
  { value: 'bolo', label: 'BOLO', color: 'bg-purple-600 text-white', icon: 'Eye' },
  { value: 'weather', label: 'Weather', color: 'bg-cyan-600 text-white', icon: 'CloudLightning' },
  { value: 'medical', label: 'Medical', color: 'bg-pink-600 text-white', icon: 'Heart' },
  { value: 'custom', label: 'Custom', color: 'bg-gray-600 text-white', icon: 'Bell' },
] as const;

export function useAlerts() {
  const { tenant, user, member } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [encryptionReady, setEncryptionReady] = useState(false);
  const encKeyRef = useRef<string | null>(null);

  // Load tenant encryption key
  useEffect(() => {
    async function loadKey() {
      if (!tenant) return;
      const { data } = await supabase
        .from('tenant_encryption_keys')
        .select('encryption_key')
        .eq('tenant_id', tenant.id)
        .eq('key_name', 'chat')
        .eq('is_active', true)
        .single();
      if (data?.encryption_key) {
        encKeyRef.current = data.encryption_key;
        setEncryptionReady(true);
      }
    }
    loadKey();
  }, [tenant]);

  // Decrypt a single alert
  const decryptAlert = useCallback(async (alert: Alert): Promise<Alert> => {
    if (!alert.is_encrypted || !encKeyRef.current) return alert;
    const [title, message] = await Promise.all([
      decryptMessage(alert.title, encKeyRef.current),
      decryptMessage(alert.message, encKeyRef.current),
    ]);
    return { ...alert, title, message };
  }, []);

  const fetchAlerts = useCallback(async () => {
    if (!tenant || !user) return;
    setLoading(true);

    const { data: alertsData } = await supabase
      .from('alerts')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false });

    if (alertsData) {
      // Check which ones current user has acknowledged
      const { data: acks } = await supabase
        .from('alert_acknowledgments')
        .select('alert_id')
        .eq('user_id', user.id);

      const ackSet = new Set((acks || []).map(a => a.alert_id));
      const withAcks = alertsData.map(a => ({ ...a, is_acknowledged: ackSet.has(a.id) }));
      // Decrypt encrypted alerts
      const decrypted = await Promise.all(withAcks.map(a => decryptAlert(a)));
      setAlerts(decrypted);
    }
    setLoading(false);
  }, [tenant, user]);

  const createAlert = useCallback(async (alert: Partial<Alert>) => {
    if (!tenant || !user || !member) return;

    let finalTitle = alert.title || '';
    let finalMessage = alert.message || '';
    let encrypted = false;

    // Encrypt title and message if key is available
    if (encKeyRef.current) {
      finalTitle = await encryptMessage(finalTitle, encKeyRef.current);
      finalMessage = await encryptMessage(finalMessage, encKeyRef.current);
      encrypted = true;
    }

    const { data, error } = await supabase
      .from('alerts')
      .insert({
        ...alert,
        title: finalTitle,
        message: finalMessage,
        is_encrypted: encrypted,
        tenant_id: tenant.id,
        created_by: user.id,
        created_by_name: member.display_name,
      })
      .select()
      .single();
    if (data) await fetchAlerts();
    return { data, error };
  }, [tenant, user, member, fetchAlerts]);

  const acknowledgeAlert = useCallback(async (alertId: string) => {
    if (!user || !member) return;
    await supabase.from('alert_acknowledgments').insert({
      alert_id: alertId,
      user_id: user.id,
      user_name: member.display_name,
    });
    // Increment count
    const alert = alerts.find(a => a.id === alertId);
    if (alert) {
      await supabase.from('alerts')
        .update({ acknowledged_count: (alert.acknowledged_count || 0) + 1 })
        .eq('id', alertId);
    }
    await fetchAlerts();
  }, [user, member, alerts, fetchAlerts]);

  const deactivateAlert = useCallback(async (alertId: string) => {
    await supabase.from('alerts').update({ is_active: false }).eq('id', alertId);
    await fetchAlerts();
  }, [fetchAlerts]);

  const fetchAcknowledgments = useCallback(async (alertId: string) => {
    const { data } = await supabase
      .from('alert_acknowledgments')
      .select('*')
      .eq('alert_id', alertId)
      .order('acknowledged_at', { ascending: false });
    return data || [];
  }, []);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const activeAlerts = alerts.filter(a => a.is_active);
  const unacknowledgedAlerts = activeAlerts.filter(a => !a.is_acknowledged);

  return {
    alerts,
    activeAlerts,
    unacknowledgedAlerts,
    loading,
    encryptionReady,
    fetchAlerts,
    createAlert,
    acknowledgeAlert,
    deactivateAlert,
    fetchAcknowledgments,
  };
}
