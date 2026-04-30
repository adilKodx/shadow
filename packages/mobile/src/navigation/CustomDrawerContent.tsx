// CustomDrawerContent.tsx — ShadowField tactical drawer
// Drop-in replacement for the default React Navigation drawer content.
//
// Wire-up in DrawerNav.tsx:
//   import CustomDrawerContent from './CustomDrawerContent';
//   <Drawer.Navigator
//     drawerContent={(props) => <CustomDrawerContent {...props} />}
//     screenOptions={{
//       headerShown: false,
//       drawerStyle: { backgroundColor: 'transparent', width: 300 },
//       drawerType: 'front',
//       overlayColor: 'rgba(0,0,0,0.6)',
//     }}
//   >...</Drawer.Navigator>

import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, Pattern, Path, RadialGradient, Stop, Rect } from 'react-native-svg';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import { spacing, radius, typography, type ThemeColors } from '../theme';
import { useThemeColors } from '../context/ThemeContext';
import { GlowDot, MonoLabel } from '../components/ui';
import { brandFooter } from '../brand';

type NavTarget = 'tab' | 'drawer' | 'unimplemented';

type NavItem = {
  route: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  badge?: number;
  severity?: 'critical' | 'normal';
  target: NavTarget;
};

const NAV_ITEMS: NavItem[] = [
  { route: 'Dashboard', label: 'Dashboard', icon: 'grid-outline', target: 'tab' },
  { route: 'Chat', label: 'Chat', icon: 'chatbubble-outline', badge: 3, target: 'drawer' },
  { route: 'Notifications', label: 'Notifications', icon: 'notifications-outline', badge: 12, target: 'drawer' },
  { route: 'News', label: 'News', icon: 'newspaper-outline', target: 'tab' },
  { route: 'Alerts', label: 'Alerts', icon: 'warning-outline', badge: 2, severity: 'critical', target: 'tab' },
  { route: 'Incidents', label: 'Incidents', icon: 'document-text-outline', target: 'unimplemented' },
  { route: 'SOPs', label: 'SOPs', icon: 'clipboard-outline', target: 'unimplemented' },
  { route: 'LiveMap', label: 'Live Map', icon: 'map-outline', target: 'drawer' },
  { route: 'POI', label: 'POI Database', icon: 'person-outline', target: 'unimplemented' },
  { route: 'Team', label: 'Team', icon: 'people-outline', target: 'unimplemented' },
  { route: 'Attendance', label: 'Attendance', icon: 'calendar-outline', target: 'unimplemented' },
];

export default function CustomDrawerContent(props: DrawerContentComponentProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Resolve nested active route so a focused tab inside MainTabs (Dashboard/News/Alerts)
  // highlights the corresponding drawer item rather than "MainTabs".
  const activeRouteName = useMemo(() => {
    const drawerRoute = props.state.routes[props.state.index];
    const nested = (drawerRoute as any).state;
    if (nested && Array.isArray(nested.routeNames) && typeof nested.index === 'number') {
      return nested.routeNames[nested.index] ?? drawerRoute.name;
    }
    return drawerRoute.name;
  }, [props.state]);

  // Replace these with your actual user data from useAuth() etc.
  const user = {
    initial: 'T',
    name: 'Tariq Aziz',
    org: 'First Test Org',
    role: 'OWNER · OPERATOR',
  };

  const handleNavigate = (item: NavItem) => {
    if (item.target === 'unimplemented') {
      // Screen not yet built; close drawer silently.
      props.navigation.closeDrawer();
      return;
    }
    if (item.target === 'tab') {
      // Tabs live inside the MainTabs drawer screen.
      (props.navigation as any).navigate('MainTabs', { screen: item.route });
    } else {
      (props.navigation as any).navigate(item.route);
    }
    props.navigation.closeDrawer();
  };

  const handleSignOut = () => {
    // Hook into your auth context here
    // signOut?.();
    props.navigation.closeDrawer();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Background — radial glow + grid */}
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern id="dr-grid" width={32} height={32} patternUnits="userSpaceOnUse">
            <Path d="M32 0H0v32" fill="none" stroke={colors.primary} strokeOpacity={0.06} strokeWidth={0.5} />
          </Pattern>
          <RadialGradient id="dr-glow" cx="0%" cy="20%" r="80%">
            <Stop offset="0%" stopColor={colors.primary} stopOpacity={0.25} />
            <Stop offset="100%" stopColor={colors.primary} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#dr-grid)" />
        <Rect width="100%" height="100%" fill="url(#dr-glow)" />
      </Svg>

      {/* Top: Profile */}
      <View style={styles.profile}>
        <View style={styles.statusPill}>
          <GlowDot color={colors.success} size={5} />
          <MonoLabel color={colors.success}>ON DUTY</MonoLabel>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <LinearGradient
            colors={[colors.primary, colors.accent] as any}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>{user.initial}</Text>
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.label, color: colors.text, fontSize: 15 }}>{user.name}</Text>
            <Text style={{ ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 }}>{user.org}</Text>
          </View>
        </View>

        <View style={styles.roleChip}>
          <Text style={{ color: colors.accent }}>◈</Text>
          <MonoLabel color={colors.primary}>{user.role}</MonoLabel>
        </View>
      </View>

      {/* Middle: Nav items */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 12 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: 10, paddingBottom: 6 }}>
          <MonoLabel color={colors.textMute}>NAVIGATION</MonoLabel>
        </View>

        {NAV_ITEMS.map((item) => {
          const isActive = item.route === activeRouteName;
          const isDisabled = item.target === 'unimplemented';
          const badgeColor = item.severity === 'critical' ? colors.error : colors.primary;
          return (
            <TouchableOpacity
              key={item.route}
              activeOpacity={isDisabled ? 1 : 0.7}
              onPress={() => handleNavigate(item)}
              disabled={isDisabled}
              style={[
                styles.navItem,
                isActive && {
                  borderLeftColor: colors.primary,
                  backgroundColor: colors.primaryLight,
                },
                isDisabled && { opacity: 0.45 },
              ]}
            >
              <View
                style={[
                  styles.navIconBox,
                  {
                    borderColor: isActive ? colors.primary + '55' : colors.border,
                    backgroundColor: isActive ? colors.primary + '22' : 'transparent',
                  },
                ]}
              >
                <Ionicons
                  name={item.icon}
                  size={16}
                  color={isActive ? colors.primary : colors.textSecondary}
                />
              </View>
              <Text
                style={{
                  ...typography.body,
                  flex: 1,
                  color: isActive ? colors.text : colors.textSecondary,
                  fontWeight: isActive ? '600' : '500',
                }}
              >
                {item.label}
              </Text>
              {item.badge ? (
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: badgeColor + '22',
                      borderColor: badgeColor + '55',
                      shadowColor: badgeColor,
                      shadowOpacity: item.severity === 'critical' ? 0.5 : 0.3,
                    },
                  ]}
                >
                  <Text style={{ ...typography.mono, color: badgeColor, fontSize: 10, fontWeight: '700' }}>
                    {item.badge}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}

        {/* Shift status card */}
        <View style={styles.shiftCard}>
          <MonoLabel color={colors.textMute}>SHIFT STATUS</MonoLabel>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <View>
              <Text style={{ ...typography.h2, color: colors.text }}>04:32</Text>
              <Text style={{ ...typography.bodySmall, color: colors.textSecondary }}>elapsed</Text>
            </View>
            <View style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <GlowDot color={colors.success} size={5} />
                <Text style={{ ...typography.bodySmall, color: colors.textSecondary }}>4 zones</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <GlowDot color={colors.warning} size={5} />
                <Text style={{ ...typography.bodySmall, color: colors.textSecondary }}>2 alerts</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom: Sign Out */}
      <View style={styles.footer}>
        <TouchableOpacity activeOpacity={0.7} onPress={handleSignOut} style={styles.signOut}>
          <View style={[styles.navIconBox, { borderColor: colors.error + '44', backgroundColor: colors.error + '18' }]}>
            <Ionicons name="log-out-outline" size={16} color={colors.error} />
          </View>
          <Text style={{ ...typography.label, color: colors.error, fontSize: 14 }}>Sign Out</Text>
        </TouchableOpacity>
        <View style={{ alignItems: 'center', marginTop: 10 }}>
          <MonoLabel color={colors.textMute}>{brandFooter()}</MonoLabel>
        </View>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      borderRightWidth: 1,
      borderRightColor: colors.border,
    },
    profile: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 18,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 12,
    },
    statusPill: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: colors.successBg,
      borderWidth: 1,
      borderColor: colors.success + '55',
    },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.5,
      shadowRadius: 18,
      elevation: 8,
    },
    avatarText: {
      ...typography.h2,
      color: '#fff',
      fontSize: 22,
    },
    roleChip: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 6,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    navItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingHorizontal: 12,
      paddingVertical: 11,
      borderRadius: 10,
      borderLeftWidth: 2,
      borderLeftColor: 'transparent',
      marginBottom: 2,
    },
    navIconBox: {
      width: 28,
      height: 28,
      borderRadius: 7,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badge: {
      minWidth: 22,
      height: 20,
      borderRadius: 10,
      paddingHorizontal: 7,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      shadowOffset: { width: 0, height: 0 },
      shadowRadius: 8,
      elevation: 3,
    },
    shiftCard: {
      marginTop: 14,
      marginHorizontal: 4,
      padding: 12,
      borderRadius: radius.md,
      backgroundColor: colors.primaryLight,
      borderWidth: 1,
      borderColor: colors.border,
    },
    footer: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    signOut: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 10,
      backgroundColor: colors.error + '0F',
      borderWidth: 1,
      borderColor: colors.error + '22',
    },
  });
