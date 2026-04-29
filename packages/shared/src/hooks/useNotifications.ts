import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { decryptMessage } from '../lib/encryption';

export interface AppNotification {
  id: string;
  type: 'alert' | 'chat' | 'incident' | 'system';
  title: string;
  body: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  channelId?: string;
  alertId?: string;
  sender?: string;
  timestamp: string;
  read: boolean;
}

const ALERT_SOUND_URL = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1pZ2t2g4yTk5GMh4B6eXZ3e4KJj5STkY2HgHx5dnh+hIuRk5KOiYR/e3h4e4GHjZGTko6JhIB8eXl8gYeNkpOSjoqFgHx5enwAAICAgICAgICAgICA';
const CRITICAL_SOUND_URL = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAAD///////8AAAEAAQABAAAA////////AAABAAIAAQAAAP///////wAAAQABAAEAAAA=';

export function useNotifications() {
  const { tenant, user, member } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const encKeyRef = useRef<string | null>(null);
  const alertAudioRef = useRef<HTMLAudioElement | null>(null);
  const criticalAudioRef = useRef<HTMLAudioElement | null>(null);
  const subscriptionsRef = useRef<any[]>([]);

  // Load encryption key
  useEffect(() => {
    if (!tenant) return;
    supabase
      .from('tenant_encryption_keys')
      .select('encryption_key')
      .eq('tenant_id', tenant.id)
      .eq('key_name', 'chat')
      .eq('is_active', true)
      .single()
      .then(({ data }) => {
        if (data?.encryption_key) encKeyRef.current = data.encryption_key;
      });
  }, [tenant]);

  // Init audio (browser-only)
  useEffect(() => {
    if (typeof Audio === 'undefined') return;
    alertAudioRef.current = new Audio(ALERT_SOUND_URL);
    criticalAudioRef.current = new Audio(CRITICAL_SOUND_URL);
    alertAudioRef.current.volume = 0.5;
    criticalAudioRef.current.volume = 0.8;
  }, []);

  // Request browser notification permission (browser-only)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        setPushEnabled(true);
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(perm => setPushEnabled(perm === 'granted'));
      }
    }
  }, []);

  const playSound = useCallback((priority: string) => {
    if (!soundEnabled) return;
    try {
      if (priority === 'critical') {
        criticalAudioRef.current?.play().catch(() => {});
      } else {
        alertAudioRef.current?.play().catch(() => {});
      }
    } catch {}
  }, [soundEnabled]);

  const showBrowserNotification = useCallback((title: string, body: string, tag?: string) => {
    if (typeof document === 'undefined') return;
    if (!pushEnabled || document.hasFocus()) return;
    try {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: tag || `sf-${Date.now()}`,
        requireInteraction: false,
      });
    } catch {}
  }, [pushEnabled]);

  const addNotification = useCallback((notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotif: AppNotification = {
      ...notif,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      read: false,
    };
    setNotifications(prev => [newNotif, ...prev].slice(0, 50));
    setUnreadCount(prev => prev + 1);
    if (notif.type === 'chat') setUnreadChatCount(prev => prev + 1);

    // Sound
    playSound(notif.priority);

    // Browser notification
    showBrowserNotification(notif.title, notif.body, notif.alertId || notif.channelId);

    return newNotif;
  }, [playSound, showBrowserNotification]);

  // Subscribe to real-time alerts
  useEffect(() => {
    if (!tenant || !user) return;

    // Listen for new alerts
    const alertSub = supabase
      .channel('rt-alerts')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'alerts',
        filter: `tenant_id=eq.${tenant.id}`,
      }, async (payload) => {
        const alert = payload.new as any;
        if (alert.created_by === user.id) return; // Don't notify yourself

        let title = alert.title;
        let message = alert.message;
        if (alert.is_encrypted && encKeyRef.current) {
          title = await decryptMessage(title, encKeyRef.current);
          message = await decryptMessage(message, encKeyRef.current);
        }

        addNotification({
          type: 'alert',
          title: `🚨 ${title}`,
          body: message,
          priority: alert.priority || 'high',
          alertId: alert.id,
        });
      })
      .subscribe();

    // Listen for new chat messages (all channels)
    const chatSub = supabase
      .channel('rt-chat-global')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
      }, async (payload) => {
        const msg = payload.new as any;
        if (msg.sender_id === user.id) return;

        let content = msg.content;
        if (msg.is_encrypted && encKeyRef.current) {
          content = await decryptMessage(content, encKeyRef.current);
        }
        // Truncate for notification
        const preview = content.length > 80 ? content.slice(0, 80) + '...' : content;

        addNotification({
          type: 'chat',
          title: `💬 ${msg.sender_name}`,
          body: preview,
          priority: msg.message_type === 'alert' ? 'high' : 'normal',
          channelId: msg.channel_id,
          sender: msg.sender_name,
        });
      })
      .subscribe();

    // Listen for new incidents
    const incidentSub = supabase
      .channel('rt-incidents')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'incidents',
        filter: `tenant_id=eq.${tenant.id}`,
      }, (payload) => {
        const incident = payload.new as any;
        if (incident.reported_by === user.id) return;

        addNotification({
          type: 'incident',
          title: `📋 New Incident: ${incident.title || 'Untitled'}`,
          body: incident.description?.slice(0, 100) || 'New incident reported',
          priority: incident.severity === 'critical' ? 'critical' : 'high',
        });
      })
      .subscribe();

    subscriptionsRef.current = [alertSub, chatSub, incidentSub];

    return () => {
      subscriptionsRef.current.forEach(sub => supabase.removeChannel(sub));
    };
  }, [tenant, user, addNotification]);

  const markRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
    setUnreadChatCount(0);
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
    setUnreadChatCount(0);
  }, []);

  const resetChatCount = useCallback(() => {
    setUnreadChatCount(0);
  }, []);

  return {
    notifications,
    unreadCount,
    unreadChatCount,
    pushEnabled,
    soundEnabled,
    setSoundEnabled,
    addNotification,
    markRead,
    markAllRead,
    clearAll,
    resetChatCount,
  };
}
