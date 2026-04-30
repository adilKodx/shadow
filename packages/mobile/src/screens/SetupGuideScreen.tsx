// ============================================================================
// SetupGuideScreen
//
// A dedicated full-screen onboarding/help destination that shows:
//   1. Device-specific compatibility guidance (Xiaomi/MIUI, Samsung, etc.)
//   2. Quick links to test push notifications and check current state
//   3. FAQ-style explanations of what each permission does
//
// Reachable from the Drawer (Setup Guide) and from a "Help" link on the
// Notifications settings screen.
// ============================================================================

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import DeviceCompatGuide from '../components/DeviceCompatGuide';
import { colors, spacing, radius, typography, shadow } from '../theme';
import { BRAND } from '../brand';

export default function SetupGuideScreen({ navigation }: any) {
  const [permission, setPermission] = React.useState<string>('…');

  React.useEffect(() => {
    Notifications.getPermissionsAsync().then((s) => setPermission(s.status));
  }, []);

  const sendTest = async () => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Test alert',
        body: 'If you see this, your phone is set up correctly.',
        data: { type: 'test' },
        sound: 'default',
      },
      trigger: null,
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() =>
            navigation?.canGoBack() ? navigation.goBack() : navigation?.navigate('MainTabs')
          }
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Setup Guide</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="rocket" size={28} color={colors.primary} />
          </View>
          <Text style={styles.heroTitle}>Get the most out of {BRAND.appName}</Text>
          <Text style={styles.heroSub}>
            Some Android phones need extra permissions for incident pushes and zone alerts to
            arrive reliably. This page tells you exactly what to enable on your device.
          </Text>
        </View>

        {/* Device-specific guide */}
        <DeviceCompatGuide forceOpen />

        {/* Status snapshot */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current state</Text>
          <View style={styles.statusCard}>
            <StatusRow
              icon="phone-portrait"
              label="Device"
              value={`${Device.manufacturer ?? '—'} ${Device.modelName ?? ''}`.trim()}
            />
            <StatusRow icon="logo-apple" label="Platform" value={Platform.OS.toUpperCase()} />
            <StatusRow
              icon="notifications"
              label="Notification permission"
              value={permission}
              tone={permission === 'granted' ? 'success' : 'warning'}
            />
          </View>
        </View>

        {/* Quick actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick actions</Text>

          <TouchableOpacity style={styles.actionBtn} onPress={sendTest}>
            <Ionicons name="send" size={18} color="#fff" />
            <Text style={styles.actionText}>Send a local test notification</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnSecondary]}
            onPress={() => Linking.openSettings()}
          >
            <Ionicons name="settings-outline" size={18} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.primary }]}>
              Open device settings
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnSecondary]}
            onPress={() => navigation?.navigate('NotificationSettings')}
          >
            <Ionicons name="options-outline" size={18} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.primary }]}>
              Manage notification preferences
            </Text>
          </TouchableOpacity>
        </View>

        {/* FAQ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What each permission does</Text>

          <FaqRow
            icon="notifications"
            title="Push notifications"
            body={`Lets ${BRAND.appName} wake your phone when an incident is reported. Without this, you only see alerts when the app is open.`}
          />
          <FaqRow
            icon="navigate"
            title="Location: Always allow"
            body="Required so your team can see your live position on the map and so the app can alert you when you enter or leave a zone — even when the app is closed."
          />
          <FaqRow
            icon="rocket"
            title="Autostart / background activity"
            body={`Some Android skins (MIUI, EMUI, ColorOS, FunTouch) kill background apps to save battery. You must whitelist ${BRAND.appName} or pushes won't arrive.`}
          />
          <FaqRow
            icon="battery-charging"
            title="Disable battery optimization"
            body={`Tells Android not to throttle ${BRAND.appName}'s network connection. Without this, the FCM socket disconnects after ~10 minutes of inactivity.`}
          />
          <FaqRow
            icon="lock-closed"
            title="Show on lock screen"
            body="Lets pushes appear on your lock screen so you don't miss critical alerts when your phone is in your pocket."
          />
        </View>

        {/* Troubleshooting */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Troubleshooting</Text>

          <FaqRow
            icon="warning"
            title="I'm not receiving any pushes"
            body={
              '1. Make sure permission is "granted" above\n' +
              '2. Run the device-specific steps for your phone\n' +
              '3. Tap "Send a local test notification" — if that fails, OS permission is the issue\n' +
              '4. If local works but server pushes don\'t, contact your admin'
            }
          />
          <FaqRow
            icon="time"
            title="Pushes arrive late or only when I open the app"
            body={`Your phone is in aggressive battery-save mode. Disable battery optimization and ensure background activity is allowed for ${BRAND.appName}.`}
          />
          <FaqRow
            icon="walk"
            title="Zone enter/exit alerts don't fire"
            body='Location permission must be set to "Allow always" (not just "While using"). Background App Refresh must also be on (iOS) or background activity allowed (Android).'
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ----------------------------------------------------------------------------
// Subcomponents
// ----------------------------------------------------------------------------
function StatusRow({
  icon,
  label,
  value,
  tone,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  tone?: 'success' | 'warning';
}) {
  const valueColor =
    tone === 'success' ? colors.success : tone === 'warning' ? colors.warning : colors.text;
  return (
    <View style={styles.statusRow}>
      <Ionicons name={icon} size={16} color={colors.textSecondary} />
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={[styles.statusValue, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

function FaqRow({
  icon,
  title,
  body,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <TouchableOpacity
      style={styles.faqRow}
      activeOpacity={0.7}
      onPress={() => setOpen((v) => !v)}
    >
      <View style={styles.faqHeader}>
        <View style={styles.faqIcon}>
          <Ionicons name={icon} size={16} color={colors.primary} />
        </View>
        <Text style={styles.faqTitle}>{title}</Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textSecondary}
        />
      </View>
      {open && <Text style={styles.faqBody}>{body}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

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

  hero: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heroTitle: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  heroSub: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  section: { paddingHorizontal: spacing.md, paddingTop: spacing.lg },
  sectionTitle: {
    ...typography.label,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },

  statusCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.xs,
    ...shadow.sm,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  statusLabel: { ...typography.body, color: colors.textSecondary, flex: 1 },
  statusValue: { ...typography.body, fontWeight: '700' },

  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    ...shadow.sm,
  },
  actionBtnSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  actionText: { color: '#fff', fontWeight: '700' },

  faqRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
    ...shadow.sm,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  faqIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  faqTitle: { ...typography.body, color: colors.text, fontWeight: '600', flex: 1 },
  faqBody: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    paddingLeft: 36,
    paddingBottom: spacing.sm,
    lineHeight: 18,
  },
});
