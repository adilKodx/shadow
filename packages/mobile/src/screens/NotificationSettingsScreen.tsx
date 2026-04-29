import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { useNotificationPreferences } from '@shadowfield/shared/src/hooks/useNotificationPreferences';
import { useAuth } from '@shadowfield/shared/src/context/AuthContext';
import {
  registerDeviceForPush,
  requestPushPermissions,
} from '../services/pushNotifications';
import {
  startBackgroundTracking,
  stopBackgroundTracking,
  isBackgroundTrackingActive,
} from '../services/backgroundLocation';
import { colors, spacing, radius, typography, shadow } from '../theme';

interface RowProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  value: boolean;
  disabled?: boolean;
  onToggle: (next: boolean) => void;
}

function ToggleRow({ icon, title, description, value, disabled, onToggle }: RowProps) {
  return (
    <View style={[styles.row, disabled && { opacity: 0.45 }]}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onToggle}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor="#fff"
      />
    </View>
  );
}

// Format a 24h "HH:MM" string into a friendly 12h label.
function formatTime12(value: string | null | undefined): string {
  if (!value) return '—';
  const [hStr, mStr] = value.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return value;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];

interface TimePickerModalProps {
  visible: boolean;
  title: string;
  initial: string | null | undefined; // "HH:MM"
  onCancel: () => void;
  onConfirm: (value: string) => void;
}

// Self-contained time picker — two scroll columns (hour + minute).
// Built in-app so we don't need to add @react-native-community/datetimepicker
// (which would force a native rebuild).
function TimePickerModal({ visible, title, initial, onCancel, onConfirm }: TimePickerModalProps) {
  const [hour, setHour] = React.useState<number>(0);
  const [minute, setMinute] = React.useState<number>(0);

  React.useEffect(() => {
    if (!visible) return;
    const [hStr, mStr] = (initial ?? '22:00').split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    setHour(Number.isNaN(h) ? 22 : h);
    // Snap minute to the nearest 15
    setMinute(Number.isNaN(m) ? 0 : Math.round(m / 15) * 15 % 60);
  }, [visible, initial]);

  const pad = (n: number) => n.toString().padStart(2, '0');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          <View style={styles.pickerRow}>
            <ScrollView
              style={styles.pickerCol}
              contentContainerStyle={styles.pickerColContent}
              showsVerticalScrollIndicator={false}
            >
              {HOURS.map((h) => (
                <TouchableOpacity
                  key={h}
                  style={[styles.pickerCell, hour === h && styles.pickerCellActive]}
                  onPress={() => setHour(h)}
                >
                  <Text style={[styles.pickerCellText, hour === h && styles.pickerCellTextActive]}>
                    {pad(h)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.pickerSeparator}>:</Text>
            <ScrollView
              style={styles.pickerCol}
              contentContainerStyle={styles.pickerColContent}
              showsVerticalScrollIndicator={false}
            >
              {MINUTES.map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.pickerCell, minute === m && styles.pickerCellActive]}
                  onPress={() => setMinute(m)}
                >
                  <Text style={[styles.pickerCellText, minute === m && styles.pickerCellTextActive]}>
                    {pad(m)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          <Text style={styles.pickerPreview}>
            Selected: <Text style={{ fontWeight: '700' }}>{formatTime12(`${pad(hour)}:${pad(minute)}`)}</Text>
          </Text>
          <View style={styles.modalActions}>
            <TouchableOpacity style={[styles.modalBtn, styles.modalBtnGhost]} onPress={onCancel}>
              <Text style={styles.modalBtnGhostText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, styles.modalBtnPrimary]}
              onPress={() => onConfirm(`${pad(hour)}:${pad(minute)}`)}
            >
              <Text style={styles.modalBtnPrimaryText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function NotificationSettingsScreen({ navigation }: any) {
  const { user, tenant, member } = useAuth();
  const { prefs, loading, saving, updatePrefs } = useNotificationPreferences();
  const [permissionStatus, setPermissionStatus] = React.useState<Notifications.PermissionStatus | null>(null);
  const [bgTrackingOn, setBgTrackingOn] = React.useState(false);
  const [bgBusy, setBgBusy] = React.useState(false);
  // 'start' | 'end' | null — which quiet-hour endpoint the user is editing
  const [pickerOpen, setPickerOpen] = React.useState<'start' | 'end' | null>(null);

  React.useEffect(() => {
    (async () => {
      const settings = await Notifications.getPermissionsAsync();
      setPermissionStatus(settings.status);
      setBgTrackingOn(await isBackgroundTrackingActive());
    })();
  }, []);

  const handleToggleBackground = async (next: boolean) => {
    if (!user?.id || !tenant?.id) return;
    setBgBusy(true);
    try {
      if (next) {
        const ok = await startBackgroundTracking(user.id, tenant.id, member?.display_name ?? 'Team Member');
        if (!ok) {
          Alert.alert(
            'Permission required',
            'Background tracking needs the "Allow always" location permission.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ],
          );
        }
        setBgTrackingOn(ok);
      } else {
        await stopBackgroundTracking();
        setBgTrackingOn(false);
      }
    } finally {
      setBgBusy(false);
    }
  };

  const handleEnablePermissions = async () => {
    const granted = await requestPushPermissions();
    const settings = await Notifications.getPermissionsAsync();
    setPermissionStatus(settings.status);
    if (granted && user?.id && tenant?.id) {
      await registerDeviceForPush(user.id, tenant.id);
    } else if (!granted) {
      Alert.alert(
        'Permission Denied',
        'Open Settings to enable notifications for ShadowField.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      );
    }
  };

  const sendTestPush = async () => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Test alert',
          body: 'If you see this, your phone is set up correctly.',
          data: { type: 'test' },
          sound: 'default',
        },
        trigger: null,
      });
    } catch (e: any) {
      Alert.alert('Failed', e?.message || 'Could not send test');
    }
  };

  if (loading || !prefs) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const masterOn = prefs.push_enabled && permissionStatus === 'granted';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => (navigation?.canGoBack() ? navigation.goBack() : navigation?.navigate('MainTabs'))}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {saving ? <ActivityIndicator size="small" color={colors.primary} /> : <View style={{ width: 22 }} />}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        {/* Link to dedicated Setup Guide screen */}
        <TouchableOpacity
          style={styles.setupLink}
          activeOpacity={0.7}
          onPress={() => navigation?.navigate('SetupGuide')}
        >
          <View style={styles.setupLinkIcon}>
            <Ionicons name="help-buoy" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.setupLinkTitle}>Setup Guide</Text>
            <Text style={styles.setupLinkSub}>
              Make sure your phone is configured to receive every alert
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* Permission status */}
        {permissionStatus !== 'granted' && (
          <View style={styles.banner}>
            <Ionicons name="alert-circle" size={20} color="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>Push notifications are off</Text>
              <Text style={styles.bannerSub}>
                Tap below to grant permission. Without this you won't receive incident alerts.
              </Text>
            </View>
            <TouchableOpacity style={styles.bannerBtn} onPress={handleEnablePermissions}>
              <Text style={styles.bannerBtnText}>Enable</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Master switch */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Master</Text>
          <ToggleRow
            icon="notifications"
            title="Push notifications"
            description="Receive any push notifications from ShadowField on this device"
            value={prefs.push_enabled}
            disabled={permissionStatus !== 'granted'}
            onToggle={(v) => updatePrefs({ push_enabled: v })}
          />
        </View>

        {/* Granular toggles */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Alert types</Text>
          <ToggleRow
            icon="warning"
            title="New incidents"
            description="When a new incident is reported in your team"
            value={prefs.notify_incidents}
            disabled={!masterOn}
            onToggle={(v) => updatePrefs({ notify_incidents: v })}
          />
          <ToggleRow
            icon="people"
            title="Responder updates"
            description="When someone responds to or arrives at an incident"
            value={prefs.notify_incident_responders}
            disabled={!masterOn}
            onToggle={(v) => updatePrefs({ notify_incident_responders: v })}
          />
          <ToggleRow
            icon="locate"
            title="Arrived at incident"
            description="Auto-flips your status to 'On Scene' and notifies you"
            value={prefs.notify_arrived_at_incident}
            disabled={!masterOn}
            onToggle={(v) => updatePrefs({ notify_arrived_at_incident: v })}
          />
          <ToggleRow
            icon="walk"
            title="Zone crossings"
            description="When you enter or leave a zone the team has set up"
            value={prefs.notify_zone_crossings}
            disabled={!masterOn}
            onToggle={(v) => updatePrefs({ notify_zone_crossings: v })}
          />
          <ToggleRow
            icon="exit"
            title="Off-campus"
            description="When you leave the tenant home perimeter"
            value={prefs.notify_off_campus}
            disabled={!masterOn}
            onToggle={(v) => updatePrefs({ notify_off_campus: v })}
          />
        </View>

        {/* Quiet hours */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quiet hours</Text>
          <ToggleRow
            icon="moon"
            title="Mute alerts overnight"
            description={
              prefs.quiet_start && prefs.quiet_end
                ? `${formatTime12(prefs.quiet_start)} – ${formatTime12(prefs.quiet_end)}`
                : 'Off — alerts can fire at any hour'
            }
            value={!!(prefs.quiet_start && prefs.quiet_end)}
            disabled={!masterOn}
            onToggle={(v) =>
              updatePrefs(
                v
                  ? { quiet_start: '22:00', quiet_end: '07:00' }
                  : { quiet_start: null, quiet_end: null },
              )
            }
          />
          {prefs.quiet_start && prefs.quiet_end && (
            <View style={styles.quietRange}>
              <TouchableOpacity
                style={styles.quietBtn}
                onPress={() => setPickerOpen('start')}
                disabled={!masterOn}
                activeOpacity={0.7}
              >
                <Text style={styles.quietLabel}>Start</Text>
                <Text style={styles.quietValue}>{formatTime12(prefs.quiet_start)}</Text>
              </TouchableOpacity>
              <View style={styles.quietDivider} />
              <TouchableOpacity
                style={styles.quietBtn}
                onPress={() => setPickerOpen('end')}
                disabled={!masterOn}
                activeOpacity={0.7}
              >
                <Text style={styles.quietLabel}>End</Text>
                <Text style={styles.quietValue}>{formatTime12(prefs.quiet_end)}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Background tracking */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Background</Text>
          <ToggleRow
            icon="navigate"
            title="Track when app is closed"
            description="Keep sharing your location with the team while the app is in the background"
            value={bgTrackingOn}
            disabled={bgBusy}
            onToggle={handleToggleBackground}
          />
        </View>

        {/* Test button */}
        <View style={[styles.section, { paddingTop: spacing.lg }]}>
          <Text style={styles.sectionTitle}>Diagnostics</Text>
          <TouchableOpacity style={styles.testBtn} onPress={sendTestPush}>
            <Ionicons name="send" size={18} color="#fff" />
            <Text style={styles.testBtnText}>Send a local test notification</Text>
          </TouchableOpacity>
          <Text style={styles.helpText}>
            Local tests bypass the server. To verify Firebase end-to-end, ask your admin to
            create a test incident.
          </Text>
        </View>

        {/* Info row */}
        <View style={[styles.section, { paddingTop: spacing.lg }]}>
          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={18} color={colors.primary} />
            <Text style={styles.infoText}>
              Platform: <Text style={{ fontWeight: '700' }}>{Platform.OS.toUpperCase()}</Text>{'\n'}
              Permission: <Text style={{ fontWeight: '700' }}>{permissionStatus ?? '…'}</Text>
            </Text>
          </View>
        </View>
      </ScrollView>

      <TimePickerModal
        visible={pickerOpen !== null}
        title={pickerOpen === 'start' ? 'Quiet hours start' : 'Quiet hours end'}
        initial={pickerOpen === 'start' ? prefs.quiet_start : prefs.quiet_end}
        onCancel={() => setPickerOpen(null)}
        onConfirm={(value) => {
          if (pickerOpen === 'start') updatePrefs({ quiet_start: value });
          else if (pickerOpen === 'end') updatePrefs({ quiet_end: value });
          setPickerOpen(null);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backBtn: { padding: spacing.xs },
  headerTitle: { ...typography.h3, color: colors.text, flex: 1 },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#DC2626',
    margin: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  bannerTitle: { color: '#fff', fontWeight: '700' },
  bannerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },
  bannerBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.md,
  },
  bannerBtnText: { color: '#fff', fontWeight: '700' },

  section: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
  sectionTitle: {
    ...typography.label,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.xs,
    ...shadow.sm,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { ...typography.body, color: colors.text, fontWeight: '600' },
  rowDescription: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },

  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    ...shadow.sm,
  },
  testBtnText: { color: '#fff', fontWeight: '700' },
  helpText: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' },

  infoCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  infoText: { ...typography.bodySmall, color: colors.text, flex: 1, lineHeight: 18 },

  setupLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary + '20',
    ...shadow.sm,
  },
  setupLinkIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  setupLinkTitle: { ...typography.body, color: colors.text, fontWeight: '700' },
  setupLinkSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },

  // ── Quiet hours range row ───────────────────────────────────────────────
  quietRange: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginTop: spacing.xs,
    paddingVertical: spacing.sm,
    ...shadow.sm,
  },
  quietBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  quietDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  quietLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  quietValue: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '700',
  },

  // ── Time picker modal ───────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.sm,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 200,
    marginBottom: spacing.sm,
  },
  pickerCol: {
    flex: 1,
    maxWidth: 120,
  },
  pickerColContent: {
    paddingVertical: spacing.sm,
  },
  pickerCell: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    borderRadius: radius.md,
    marginVertical: 2,
  },
  pickerCellActive: {
    backgroundColor: colors.primary + '18',
  },
  pickerCellText: {
    ...typography.h3,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  pickerCellTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  pickerSeparator: {
    ...typography.h2,
    color: colors.text,
    paddingHorizontal: spacing.sm,
  },
  pickerPreview: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  modalBtnGhost: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalBtnGhostText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  modalBtnPrimary: {
    backgroundColor: colors.primary,
  },
  modalBtnPrimaryText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '700',
  },
});
