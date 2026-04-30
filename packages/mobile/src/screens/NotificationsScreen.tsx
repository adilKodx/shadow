// NotificationsScreen.tsx — REPLACES previous version
// Matches the mockup exactly: big "Notifications" title, "2 unread · 6 today",
// pill filters (All 14, Critical 1, Incidents 6, Patrol 4, System 3),
// grouped sections (NEW · 0:48 ago / EARLIER TODAY) with pulsing critical/high items.

import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated from 'react-native-reanimated';
import { spacing, radius, typography, gradients, type ThemeColors } from '../theme';
import { useThemeColors, useIsDark } from '../context/ThemeContext';
import { useFadeUp, usePulseRing } from '../animations';
import { MonoLabel, SevChip } from '../components/ui';

const FILTERS = [
  { l: 'All', n: 14 },
  { l: 'Critical', n: 1 },
  { l: 'Incidents', n: 6 },
  { l: 'Patrol', n: 4 },
  { l: 'System', n: 3 },
];

type Item = {
  icon: keyof typeof Ionicons.glyphMap;
  colorKey: 'critical' | 'high' | 'medium' | 'low' | 'success' | 'primary' | 'accent' | 'warning';
  title: string;
  body: string;
  time: string;
  sev: 'critical' | 'high' | 'medium' | 'low' | 'resolved';
  unread?: boolean;
};

export default function NotificationsScreen({ navigation }: any) {
  const colors = useThemeColors();
  const isDark = useIsDark();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [active, setActive] = useState('All');

  const groups: { label: string; items: Item[] }[] = [
    { label: 'NEW · 0:48 ago', items: [
      { icon: 'warning', colorKey: 'critical', title: 'Critical: Perimeter breach attempt', body: 'East fence · Sector 4 · sensor triggered', time: '0:48 ago', sev: 'critical', unread: true },
      { icon: 'person', colorKey: 'high', title: 'Suspicious person near loading bay', body: 'Zone A · Warehouse 17 · Marcus dispatched', time: '2m ago', sev: 'high', unread: true },
    ]},
    { label: 'EARLIER TODAY', items: [
      { icon: 'videocam-off', colorKey: 'warning', title: 'Camera CAM-22 went offline', body: 'Roof · last seen 14:02', time: '38m ago', sev: 'low' },
      { icon: 'checkmark-circle', colorKey: 'success', title: 'Patrol Route 7 completed', body: 'Jordan R. · 22 / 22 checkpoints · 0 issues', time: '1h ago', sev: 'resolved' },
      { icon: 'flash', colorKey: 'primary', title: 'Backup power test passed', body: 'Generator B · 4m runtime · nominal', time: '2h ago', sev: 'low' },
      { icon: 'shield-checkmark', colorKey: 'accent', title: 'Shift handover: night team', body: 'Sgt. Vega assumed command · 8 units', time: '3h ago', sev: 'medium' },
    ]},
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {isDark && <View pointerEvents="none" style={[styles.glow, { top: -120, right: -120, backgroundColor: colors.primary }]} />}

      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Title block */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.lg }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Notifications</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <Text style={[styles.sub, { color: colors.error }]}>2 unread</Text>
              <Text style={styles.sub}> · 6 today</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="filter" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Pill filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.lg }}>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {FILTERS.map(f => {
              const isActive = f.l === active;
              if (isActive) {
                return (
                  <TouchableOpacity key={f.l} onPress={() => setActive(f.l)} style={{ borderRadius: radius.full, overflow: 'hidden' }}>
                    <LinearGradient colors={gradients.brand as any} style={styles.pill}>
                      <Text style={[styles.pillText, { color: '#0A0A14' }]}>{f.l}</Text>
                      <View style={[styles.pillBadge, { backgroundColor: 'rgba(10,10,20,0.18)' }]}>
                        <Text style={[styles.pillBadgeText, { color: '#0A0A14' }]}>{f.n}</Text>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                );
              }
              return (
                <TouchableOpacity key={f.l} onPress={() => setActive(f.l)} style={[styles.pill, styles.pillInactive]}>
                  <Text style={[styles.pillText, { color: colors.text }]}>{f.l}</Text>
                  <View style={[styles.pillBadge, { backgroundColor: colors.surfaceMute }]}>
                    <Text style={[styles.pillBadgeText, { color: colors.textSecondary }]}>{f.n}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Groups */}
        {groups.map((g, gi) => (
          <View key={g.label} style={{ marginBottom: spacing.xl }}>
            <MonoLabel style={{ marginBottom: spacing.sm }}>{g.label}</MonoLabel>
            <View style={{ gap: spacing.sm }}>
              {g.items.map((item, i) => (
                <NotifRow key={i} item={item} index={gi * 10 + i} colors={colors} styles={styles} />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function NotifRow({ item, index, colors, styles }: any) {
  const fade = useFadeUp(index, 50);
  const pulse = usePulseRing(0);
  const accent = item.colorKey === 'critical' ? colors.critical
    : item.colorKey === 'high' ? colors.high
    : item.colorKey === 'medium' ? colors.medium
    : item.colorKey === 'low' ? colors.low
    : item.colorKey === 'success' ? colors.success
    : item.colorKey === 'warning' ? colors.warning
    : item.colorKey === 'accent' ? colors.accent
    : colors.primary;
  const showPulse = (item.colorKey === 'critical' || item.colorKey === 'high') && item.unread;

  return (
    <Animated.View style={fade}>
      <View style={[
        styles.row,
        item.unread && {
          borderColor: accent + '88',
          backgroundColor: accent + '0D',
          shadowColor: accent, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 4,
        },
      ]}>
        {/* Icon with optional pulse */}
        <View style={styles.iconWrap}>
          {showPulse && (
            <Animated.View pointerEvents="none" style={[{
              position: 'absolute', width: 56, height: 56, borderRadius: 28,
              borderWidth: 1.5, borderColor: accent, top: -6, left: -6,
            }, pulse]} />
          )}
          <View style={[styles.iconBg, { backgroundColor: accent + '22', borderColor: accent + '44' }]}>
            <Ionicons name={item.icon} size={20} color={accent} />
          </View>
        </View>

        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.itemBody} numberOfLines={1}>{item.body}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <SevChip level={item.sev} />
            <MonoLabel>{item.time}</MonoLabel>
          </View>
        </View>

        {item.unread && <View style={[styles.unreadDot, { backgroundColor: accent }]} />}
      </View>
    </Animated.View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  glow: { position: 'absolute', width: 280, height: 280, borderRadius: 140, opacity: 0.18 },
  title: { ...typography.display, fontSize: 34, color: colors.text, letterSpacing: -1 },
  sub: { ...typography.mono, fontSize: 12, color: colors.textSecondary },
  iconBtn: {
    width: 44, height: 44, borderRadius: radius.md,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full,
  },
  pillInactive: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  pillText: { fontSize: 13, fontWeight: '600' },
  pillBadge: {
    minWidth: 20, paddingHorizontal: 6, height: 18, borderRadius: 9,
    justifyContent: 'center', alignItems: 'center',
  },
  pillBadgeText: { fontSize: 10, fontWeight: '700' },
  row: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  iconWrap: { position: 'relative', width: 44, height: 44 },
  iconBg: {
    width: 44, height: 44, borderRadius: radius.md, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
  },
  itemTitle: { ...typography.label, fontSize: 15, color: colors.text, lineHeight: 20 },
  itemBody: { ...typography.bodySmall, color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  unreadDot: {
    width: 8, height: 8, borderRadius: 4, marginLeft: 8, marginTop: 4,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2,
  },
});
