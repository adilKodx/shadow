// ============================================================================
// DeviceCompatGuide
//
// A device-aware onboarding card shown in the Notifications screen.
// Detects the phone's manufacturer and surfaces the EXACT settings the user
// needs to enable for FCM push notifications + background location to work
// reliably. Different OEMs (Xiaomi/MIUI, Huawei/EMUI, Oppo/ColorOS, Vivo, etc.)
// kill background apps and FCM sockets unless specific autostart / battery
// permissions are granted.
//
// The card is collapsible, persists "I've finished setup" state via AsyncStorage,
// and links into native Settings via Linking.openSettings() where possible.
// ============================================================================

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, shadow } from '../theme';

const STORAGE_KEY = '@sf_setup_acknowledged_v1';

type Step = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  critical?: boolean;
};

type Vendor = {
  label: string;
  reason: string;
  steps: Step[];
};

// ----------------------------------------------------------------------------
// OEM-specific guides. Keys are matched case-insensitively against
// Device.manufacturer. Entries appear in priority order — first match wins.
// ----------------------------------------------------------------------------
const VENDORS: Record<string, Vendor> = {
  xiaomi: {
    label: 'Xiaomi / Redmi / POCO (MIUI)',
    reason:
      'MIUI aggressively kills apps and blocks Firebase by default. Without these settings you will miss alerts.',
    steps: [
      {
        icon: 'rocket',
        title: 'Enable Autostart',
        description:
          'Settings → Apps → Permissions → Autostart → enable ShadowField. Without this, push notifications cannot arrive when the app is closed.',
        critical: true,
      },
      {
        icon: 'battery-charging',
        title: 'Battery saver: No restrictions',
        description:
          'Settings → Apps → Manage apps → ShadowField → Battery saver → set to "No restrictions".',
        critical: true,
      },
      {
        icon: 'eye',
        title: 'Allow background activity',
        description:
          'In ShadowField app info → Other permissions → enable "Display pop-up windows while running in the background", "Start in background", and "Show on lock screen".',
        critical: true,
      },
      {
        icon: 'lock-closed',
        title: 'Lock app in recent tasks',
        description:
          'Open Recent Apps → drag ShadowField down → tap the padlock icon. Prevents MIUI from auto-killing it.',
      },
    ],
  },
  huawei: {
    label: 'Huawei / Honor (EMUI / HarmonyOS)',
    reason:
      'EMUI uses "Power-intensive prompt" and Protected apps to suppress background services. Push notifications fail silently otherwise.',
    steps: [
      {
        icon: 'rocket',
        title: 'Mark as Protected app',
        description:
          'Settings → Battery → App launch → ShadowField → toggle OFF "Manage automatically", then enable Auto-launch, Secondary launch, and Run in background.',
        critical: true,
      },
      {
        icon: 'battery-charging',
        title: 'Disable power-intensive prompt',
        description:
          'Settings → Battery → More battery settings → Close apps after screen lock → exclude ShadowField.',
        critical: true,
      },
    ],
  },
  oppo: {
    label: 'Oppo / Realme (ColorOS)',
    reason:
      'ColorOS terminates background apps within a few minutes by default and blocks FCM unless auto-startup is granted.',
    steps: [
      {
        icon: 'rocket',
        title: 'Allow auto-startup',
        description:
          'Settings → App Management → Auto-startup → enable ShadowField.',
        critical: true,
      },
      {
        icon: 'battery-charging',
        title: 'Power saving: Allow background',
        description:
          'Settings → Battery → App battery management → ShadowField → enable "Allow background activity" and "Allow auto-launch".',
        critical: true,
      },
      {
        icon: 'notifications',
        title: 'Lock-screen notifications',
        description:
          'Settings → Notification & status bar → ShadowField → enable "Lock screen notifications".',
      },
    ],
  },
  vivo: {
    label: 'Vivo / iQOO (FunTouchOS / OriginOS)',
    reason:
      'Vivo phones aggressively close apps for battery savings; FCM cannot maintain its socket.',
    steps: [
      {
        icon: 'rocket',
        title: 'Enable Auto-start',
        description:
          'Settings → Battery → High background power consumption → enable ShadowField. Also: Settings → More settings → Permission management → Autostart → enable ShadowField.',
        critical: true,
      },
      {
        icon: 'battery-charging',
        title: 'Background power consumption',
        description:
          'Settings → Battery → Background power consumption management → ShadowField → "Allow background high power consumption".',
        critical: true,
      },
    ],
  },
  oneplus: {
    label: 'OnePlus (OxygenOS)',
    reason:
      'OxygenOS battery optimizer can throttle FCM. Disabling for ShadowField improves reliability.',
    steps: [
      {
        icon: 'battery-charging',
        title: 'Battery: Don\'t optimize',
        description:
          'Settings → Battery → Battery optimization → ShadowField → "Don\'t optimize".',
        critical: true,
      },
      {
        icon: 'rocket',
        title: 'Allow background activity',
        description:
          'Settings → Apps → ShadowField → Battery → enable "Allow background activity".',
      },
    ],
  },
  samsung: {
    label: 'Samsung (One UI)',
    reason:
      'Samsung\'s "Sleeping apps" feature suspends background apps. Add ShadowField to "Apps that won\'t be put to sleep".',
    steps: [
      {
        icon: 'battery-charging',
        title: 'Never put to sleep',
        description:
          'Settings → Battery and device care → Battery → Background usage limits → "Never sleeping apps" → add ShadowField.',
        critical: true,
      },
      {
        icon: 'rocket',
        title: 'Unrestricted battery',
        description:
          'Settings → Apps → ShadowField → Battery → "Unrestricted".',
      },
    ],
  },
  google: {
    label: 'Pixel / Google (Stock Android)',
    reason: 'Stock Android usually works fine — just confirm these basics.',
    steps: [
      {
        icon: 'battery-charging',
        title: 'Unrestricted battery usage',
        description:
          'Settings → Apps → ShadowField → App battery usage → Unrestricted.',
      },
    ],
  },
};

// Map raw manufacturer strings to vendor keys. Some phones report odd names.
const MANUFACTURER_MAP: Array<[RegExp, keyof typeof VENDORS]> = [
  [/xiaomi|redmi|poco/i, 'xiaomi'],
  [/huawei|honor/i, 'huawei'],
  [/oppo|realme/i, 'oppo'],
  [/vivo|iqoo/i, 'vivo'],
  [/oneplus/i, 'oneplus'],
  [/samsung/i, 'samsung'],
  [/google|pixel/i, 'google'],
];

function detectVendor(): Vendor | null {
  if (Platform.OS !== 'android') return null;
  const m = (Device.manufacturer || Device.brand || '').toLowerCase();
  if (!m) return null;
  for (const [re, key] of MANUFACTURER_MAP) {
    if (re.test(m)) return VENDORS[key];
  }
  return null;
}

const IOS_GUIDE: Vendor = {
  label: 'iPhone (iOS)',
  reason:
    'iOS handles background and notifications consistently across devices — just confirm these toggles.',
  steps: [
    {
      icon: 'notifications',
      title: 'Enable notifications',
      description:
        'Settings → Notifications → ShadowField → Allow Notifications, Sounds, Badges, Lock Screen, Banners.',
      critical: true,
    },
    {
      icon: 'navigate',
      title: 'Location: Always allow',
      description:
        'Settings → Privacy → Location Services → ShadowField → "Always" — required for background tracking and zone alerts.',
    },
    {
      icon: 'refresh',
      title: 'Background App Refresh ON',
      description:
        'Settings → General → Background App Refresh → ShadowField → enabled. Without this, geofence detection stops when the app is backgrounded.',
    },
  ],
};

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------
interface Props {
  forceOpen?: boolean;
}

export default function DeviceCompatGuide({ forceOpen = false }: Props) {
  const [expanded, setExpanded] = React.useState(forceOpen);
  const [acknowledged, setAcknowledged] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      const ack = v === '1';
      setAcknowledged(ack);
      if (!ack && !forceOpen) setExpanded(true); // Auto-open on first visit
    });
  }, [forceOpen]);

  const guide: Vendor = Platform.OS === 'ios' ? IOS_GUIDE : detectVendor() || {
    label: `${Device.manufacturer ?? 'Your device'}`,
    reason:
      'Your phone should work out of the box, but if pushes are unreliable check these basics.',
    steps: [
      {
        icon: 'battery-charging',
        title: 'Disable battery optimization',
        description: 'Settings → Apps → ShadowField → Battery → Unrestricted.',
      },
      {
        icon: 'notifications',
        title: 'Allow notifications',
        description:
          'Settings → Apps → ShadowField → Notifications → enable all categories.',
      },
    ],
  };

  const handleAcknowledge = async () => {
    await AsyncStorage.setItem(STORAGE_KEY, '1');
    setAcknowledged(true);
    setExpanded(false);
  };

  const handleReset = async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setAcknowledged(false);
    setExpanded(true);
  };

  const criticalCount = guide.steps.filter((s) => s.critical).length;

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.header}
        activeOpacity={0.7}
        onPress={() => setExpanded((v) => !v)}
      >
        <View style={styles.headerIcon}>
          <Ionicons
            name={acknowledged ? 'checkmark-circle' : 'phone-portrait'}
            size={22}
            color={acknowledged ? colors.success : colors.primary}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>
            {acknowledged ? 'Device setup complete' : 'Setup your device'}
          </Text>
          <Text style={styles.headerSub}>
            {guide.label}
            {!acknowledged && criticalCount > 0
              ? ` • ${criticalCount} critical step${criticalCount > 1 ? 's' : ''}`
              : ''}
          </Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.textSecondary}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.body}>
          <View style={styles.reasonBox}>
            <Ionicons name="information-circle" size={16} color={colors.primary} />
            <Text style={styles.reasonText}>{guide.reason}</Text>
          </View>

          {guide.steps.map((step, i) => (
            <View key={i} style={styles.step}>
              <View
                style={[
                  styles.stepIcon,
                  step.critical && { backgroundColor: '#DC262615' },
                ]}
              >
                <Ionicons
                  name={step.icon}
                  size={18}
                  color={step.critical ? '#DC2626' : colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  {step.critical && (
                    <View style={styles.criticalBadge}>
                      <Text style={styles.criticalBadgeText}>Required</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.stepDesc}>{step.description}</Text>
              </View>
            </View>
          ))}

          <TouchableOpacity
            style={styles.openSettingsBtn}
            onPress={() => Linking.openSettings()}
          >
            <Ionicons name="settings" size={18} color="#fff" />
            <Text style={styles.openSettingsText}>Open device settings</Text>
          </TouchableOpacity>

          {!acknowledged ? (
            <TouchableOpacity style={styles.ackBtn} onPress={handleAcknowledge}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={styles.ackText}>I've completed these steps</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.ackBtn} onPress={handleReset}>
              <Ionicons name="refresh" size={16} color={colors.textSecondary} />
              <Text style={[styles.ackText, { color: colors.textSecondary }]}>
                Show again
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { ...typography.body, color: colors.text, fontWeight: '700' },
  headerSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },

  body: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  reasonBox: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: colors.primary + '10',
    padding: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'flex-start',
  },
  reasonText: {
    ...typography.bodySmall,
    color: colors.text,
    flex: 1,
    lineHeight: 18,
  },

  step: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  stepIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTitle: { ...typography.body, color: colors.text, fontWeight: '600' },
  stepDesc: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  criticalBadge: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  criticalBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  openSettingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    marginTop: spacing.xs,
  },
  openSettingsText: { color: '#fff', fontWeight: '700' },

  ackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  ackText: { color: colors.success, fontWeight: '600' },
});
