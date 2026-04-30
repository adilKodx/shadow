// DashboardScreen.tsx — REPLACES existing
// Matches the mockup exactly: greeting + on duty header, hero ZONE A status card,
// 3-stat row (GUARDS / PATROL / CAMS), Recent Alerts feed with pulsing high-sev item,
// Active Patrol card.

import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated from 'react-native-reanimated';
import { useAuth } from '@shadowfield/shared/src/context/AuthContext';
import { spacing, radius, typography, gradients, type ThemeColors } from '../theme';
import { useThemeColors, useIsDark, useTheme } from '../context/ThemeContext';
import { useFadeUp, usePulseRing, useShimmer } from '../animations';
import { GlowDot, MonoLabel, SevChip } from '../components/ui';

const STATS = [
  { label: 'GUARDS', val: '12', sub: 'on duty', color: 'accent' as const },
  { label: 'PATROL', val: '94%', sub: 'covered', color: 'primary' as const },
  { label: 'CAMS', val: '47', sub: 'live', color: 'success' as const },
];

const ALERTS = [
  { icon: 'person', title: 'Suspicious person · Zone A', loc: 'Loading bay 3', time: '2m ago', sev: 'high' as const, live: true, color: 'high' },
  { icon: 'alert-circle', title: 'Perimeter breach attempt', loc: 'East fence · Sector 4', time: '14m ago', sev: 'critical' as const, color: 'critical' },
  { icon: 'videocam-off', title: 'Camera offline', loc: 'CAM-22 · Roof', time: '38m ago', sev: 'low' as const, color: 'low' },
];

export default function DashboardScreen({ navigation }: any) {
  const { user, member } = useAuth();
  const { toggle } = useTheme();
  const colors = useThemeColors();
  const isDark = useIsDark();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [refreshing, setRefreshing] = React.useState(false);

  const heroFade = useFadeUp(0);
  const statsFade = useFadeUp(1, 80);
  const alertsFade = useFadeUp(2, 80);
  const patrolFade = useFadeUp(3, 80);
  const shimmer = useShimmer(360, 4000);

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise(r => setTimeout(r, 800));
    setRefreshing(false);
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'GOOD MORNING';
    if (h < 17) return 'GOOD AFTERNOON';
    return 'GOOD EVENING';
  };

  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const initial = (member?.display_name || user?.email || 'U')[0].toUpperCase();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {isDark && (
        <View pointerEvents="none" style={[styles.glow, { top: -120, right: -120, backgroundColor: colors.primary }]} />
      )}

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.iconBtn}>
            <Ionicons name="menu" size={22} color={colors.text} />
          </TouchableOpacity>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <GlowDot color={colors.success} size={6} />
              <MonoLabel>{greeting()} · ON DUTY · {time}</MonoLabel>
            </View>
            <Text style={styles.headerName}>Hey, {member?.display_name?.split(' ')[0] || 'there'}.</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={toggle} style={styles.iconBtn}>
            <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={18} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate?.('Notifications')} style={styles.iconBtn}>
            <Ionicons name="notifications-outline" size={18} color={colors.text} />
            <View style={[styles.notifDot, { backgroundColor: colors.error }]} />
          </TouchableOpacity>
          <LinearGradient colors={gradients.brand as any} style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </LinearGradient>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero ZONE A status card */}
        <Animated.View style={heroFade}>
          <LinearGradient
            colors={gradients.brandSoft as any}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: 360 }, shimmer]}>
              <LinearGradient colors={['transparent', colors.primary + '22', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
            </Animated.View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <MonoLabel color={colors.accent}>ZONE A · WAREHOUSE 17</MonoLabel>
              <SevChip level="medium" />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <View>
                <Text style={styles.heroNumber}>3</Text>
                <MonoLabel>OPEN INCIDENTS</MonoLabel>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[typography.monoLg, { color: colors.success }]}>↓ 38%</Text>
                <MonoLabel>vs last shift</MonoLabel>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* 3-stat row: GUARDS / PATROL / CAMS */}
        <Animated.View style={[styles.statsRow, statsFade]}>
          {STATS.map(s => {
            const c = s.color === 'accent' ? colors.accent : s.color === 'primary' ? colors.primary : colors.success;
            return (
              <View key={s.label} style={styles.statCard}>
                <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{s.label}</Text>
                <Text style={[styles.statVal, { color: c }]}>{s.val}</Text>
                <Text style={styles.statSub}>{s.sub}</Text>
              </View>
            );
          })}
        </Animated.View>

        {/* Recent Alerts */}
        <Animated.View style={alertsFade}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Alerts</Text>
            <TouchableOpacity><Text style={styles.seeAll}>See all →</Text></TouchableOpacity>
          </View>
          <View style={{ gap: spacing.sm }}>
            {ALERTS.map((a, i) => (
              <AlertRow key={i} alert={a} colors={colors} styles={styles} />
            ))}
          </View>
        </Animated.View>

        {/* Active Patrol */}
        <Animated.View style={[patrolFade, { marginTop: spacing.xl }]}>
          <Text style={styles.sectionTitle}>Active Patrol</Text>
          <View style={styles.patrolCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <LinearGradient colors={[colors.success, colors.accent]} style={styles.patrolBadge}>
                  <Text style={styles.patrolBadgeText}>JR</Text>
                </LinearGradient>
                <View>
                  <Text style={styles.patrolName}>Jordan R.</Text>
                  <MonoLabel color={colors.success}>● ROUTE 7 · 14/22 CHECKPOINTS</MonoLabel>
                </View>
              </View>
              <MonoLabel>22m</MonoLabel>
            </View>
            <View style={styles.progressTrack}>
              <LinearGradient colors={gradients.brand as any} style={[styles.progressFill, { width: '64%' }]} />
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

function AlertRow({ alert, colors, styles }: any) {
  const pulse = usePulseRing(0);
  const sevColor = alert.color === 'critical' ? colors.critical
    : alert.color === 'high' ? colors.high
    : alert.color === 'low' ? colors.low : colors.medium;

  return (
    <View style={[styles.alertRow, alert.live && { borderColor: colors.high + '88', backgroundColor: colors.highBg }]}>
      <View style={styles.alertIconWrap}>
        {alert.live && (
          <Animated.View pointerEvents="none" style={[{
            position: 'absolute', width: 56, height: 56, borderRadius: 28,
            borderWidth: 1.5, borderColor: colors.high, top: -6, left: -6,
          }, pulse]} />
        )}
        <View style={[styles.alertIcon, { backgroundColor: sevColor + '22' }]}>
          <Ionicons name={alert.icon as any} size={20} color={sevColor} />
        </View>
      </View>
      <View style={{ flex: 1, marginLeft: spacing.md }}>
        <Text style={styles.alertTitle} numberOfLines={1}>{alert.title}</Text>
        <Text style={styles.alertLoc}>{alert.loc}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <SevChip level={alert.sev} />
        <MonoLabel>{alert.time}</MonoLabel>
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  glow: { position: 'absolute', width: 280, height: 280, borderRadius: 140, opacity: 0.18 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconBtn: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center', position: 'relative',
  },
  notifDot: { position: 'absolute', top: 9, right: 9, width: 8, height: 8, borderRadius: 4 },
  avatar: { width: 40, height: 40, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 14, fontWeight: '700', color: '#0A0A14' },
  headerName: { ...typography.h2, color: colors.text, marginTop: 2 },
  scrollContent: { padding: spacing.xl, paddingBottom: 120 },
  heroCard: {
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderStrong,
    padding: spacing.lg, overflow: 'hidden', marginBottom: spacing.lg,
  },
  heroNumber: { ...typography.display, color: colors.text, fontSize: 40 },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  statCard: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  statLabel: { ...typography.mono, fontSize: 10 },
  statVal: { ...typography.display, fontSize: 28, marginTop: 4 },
  statSub: { ...typography.bodySmall, color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { ...typography.h3, fontSize: 18, fontWeight: '700', color: colors.text },
  seeAll: { fontSize: 13, fontWeight: '600', color: colors.primary },
  alertRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 12, borderRadius: 14,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  alertIconWrap: { position: 'relative', width: 44, height: 44 },
  alertIcon: {
    width: 44, height: 44, borderRadius: radius.md,
    justifyContent: 'center', alignItems: 'center',
  },
  alertTitle: { ...typography.label, fontSize: 14, color: colors.text },
  alertLoc: { ...typography.bodySmall, color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  patrolCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginTop: spacing.sm,
  },
  patrolBadge: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  patrolBadgeText: { fontSize: 12, fontWeight: '700', color: '#0A0A14' },
  patrolName: { ...typography.label, color: colors.text, fontSize: 14 },
  progressTrack: {
    height: 6, borderRadius: 3, backgroundColor: colors.surfaceMute, marginTop: 10, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },
});
