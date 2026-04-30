// Reusable visual primitives — all theme-aware.
// Import from '../components/ui'.

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated from 'react-native-reanimated';
import { spacing, radius, typography, shadow, gradients } from '../../theme';
import { useThemeColors, useIsDark } from '../../context/ThemeContext';
import { usePulseRing, useBlink, usePressScale } from '../../animations';

// ─── GlowDot — small pulsing status dot ───
export function GlowDot({ color, size = 8 }: { color?: string; size?: number }) {
  const colors = useThemeColors();
  const c = color || colors.success;
  const blink = useBlink();
  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: c,
          shadowColor: c,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.9,
          shadowRadius: 6,
          elevation: 4,
        },
        blink,
      ]}
    />
  );
}

// ─── PulseRing — concentric expanding rings (use 2 for layered effect) ───
export function PulseRing({ size = 60, color, delay = 0 }: { size?: number; color?: string; delay?: number }) {
  const colors = useThemeColors();
  const c = color || colors.primary;
  const style = usePulseRing(delay);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1.5,
          borderColor: c,
          top: -size / 2 + size / 4, // centers when child is half size
          left: -size / 2 + size / 4,
        },
        style,
      ]}
    />
  );
}

// ─── SevChip — severity badge ───
type Sev = 'critical' | 'high' | 'medium' | 'low' | 'resolved';
export function SevChip({ level }: { level: Sev }) {
  const colors = useThemeColors();
  const map: Record<Sev, { bg: string; fg: string; label: string }> = {
    critical: { bg: colors.criticalBg, fg: colors.critical, label: 'CRITICAL' },
    high: { bg: colors.highBg, fg: colors.high, label: 'HIGH' },
    medium: { bg: colors.mediumBg, fg: colors.medium, label: 'MEDIUM' },
    low: { bg: colors.lowBg, fg: colors.low, label: 'LOW' },
    resolved: { bg: colors.successBg, fg: colors.success, label: 'RESOLVED' },
  };
  const c = map[level];
  return (
    <View style={[styles.chip, { backgroundColor: c.bg }]}>
      <View style={[styles.chipDot, { backgroundColor: c.fg, shadowColor: c.fg }]} />
      <Text style={[styles.chipLabel, { color: c.fg }]}>{c.label}</Text>
    </View>
  );
}

// ─── GlassCard — translucent card with hairline border ───
export function GlassCard({
  children,
  style,
  glow = false,
  padding = spacing.lg,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  glow?: boolean;
  padding?: number;
}) {
  const colors = useThemeColors();
  const isDark = useIsDark();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding,
          ...(isDark ? shadow.md : shadow.sm),
          ...(glow && isDark ? shadow.glow : {}),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ─── GradientCard — for hero / status cards ───
export function GradientCard({
  children,
  style,
  colors: gradColors,
  padding = spacing.lg,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  colors?: readonly [string, string, ...string[]];
  padding?: number;
}) {
  const isDark = useIsDark();
  const themeColors = useThemeColors();
  const cs = gradColors || (isDark ? gradients.brandSoft : ['#F4EFFF', '#E0F2FE'] as const);
  return (
    <LinearGradient
      colors={cs as any}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        {
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: themeColors.borderStrong,
          padding,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {children}
    </LinearGradient>
  );
}

// ─── GradientButton — primary CTA, violet→cyan ───
type ButtonVariant = 'primary' | 'ghost' | 'danger';
export function GradientButton({
  title,
  onPress,
  variant = 'primary',
  full = true,
  disabled = false,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  full?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const colors = useThemeColors();
  const press = usePressScale(0.97);

  if (variant === 'ghost') {
    return (
      <Animated.View style={[full && { width: '100%' }, press.style]}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onPress}
          onPressIn={press.onPressIn}
          onPressOut={press.onPressOut}
          disabled={disabled}
          style={[
            styles.btnBase,
            {
              backgroundColor: 'transparent',
              borderWidth: 1,
              borderColor: colors.borderStrong,
              opacity: disabled ? 0.5 : 1,
            },
            style,
          ]}
        >
          <Text style={[styles.btnText, { color: colors.text }]}>{title}</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  const grad = variant === 'danger' ? gradients.danger : gradients.brand;
  const glow = variant === 'danger' ? shadow.glowDanger : shadow.glow;

  return (
    <Animated.View style={[full && { width: '100%' }, press.style]}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        disabled={disabled}
        style={[
          { borderRadius: radius.md, overflow: 'hidden', opacity: disabled ? 0.5 : 1 },
          glow,
          style,
        ]}
      >
        <LinearGradient
          colors={grad as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.btnBase}
        >
          <Text style={[styles.btnText, { color: '#0A0A14' }]}>{title}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── GlassTabBar — wrap your bottom tab bar in this for the floating glass look ───
//   Use as `tabBar={(props) => <GlassTabBar {...props} />}` in MainTabs.
//   See windsurf/05-tab-bar.md for the complete implementation.
export function GlassWrapper({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const colors = useThemeColors();
  const isDark = useIsDark();
  return (
    <BlurView
      intensity={isDark ? 60 : 80}
      tint={isDark ? 'dark' : 'light'}
      style={[
        {
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: colors.tabBarBorder,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <View style={{ backgroundColor: colors.tabBar }}>{children}</View>
    </BlurView>
  );
}

// ─── MonoLabel — tactical caption text (timestamps, IDs, codes) ───
export function MonoLabel({ children, color, style }: { children: React.ReactNode; color?: string; style?: TextStyle }) {
  const colors = useThemeColors();
  return (
    <Text
      style={[
        typography.mono,
        { color: color || colors.textTertiary, textTransform: 'uppercase' as const },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  chipDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  chipLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
    fontFamily: 'Courier New',
  },
  btnBase: {
    height: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  btnText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
});
