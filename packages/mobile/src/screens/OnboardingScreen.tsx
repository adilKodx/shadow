// OnboardingScreen.tsx — 4-step intro with custom radar + perimeter map visuals
//
// Requires: react-native-svg, expo-linear-gradient, expo-blur, react-native-reanimated
// Already installed in packages/mobile.

import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, {
  Circle,
  Line,
  Rect,
  Path,
  Polygon,
  Defs,
  Pattern,
  RadialGradient,
  Stop,
  G,
} from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
  interpolate,
  FadeIn,
} from 'react-native-reanimated';
import { spacing, radius, typography, type ThemeColors } from '../theme';
import { useThemeColors } from '../context/ThemeContext';
import { GradientButton, MonoLabel, GlowDot } from '../components/ui';

const AnimatedG = Animated.createAnimatedComponent(G);

// ─── Reusable: pulsing ring ───
function PulseRing({
  size,
  color,
  delay = 0,
}: { size: number; color: string; delay?: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 2400, easing: Easing.out(Easing.ease) }), -1, false)
    );
  }, [delay]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(t.value, [0, 1], [0.6, 1.4]) }],
    opacity: interpolate(t.value, [0, 0.4, 1], [0, 0.6, 0]),
  }));
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1.5,
          borderColor: color,
        },
        style,
      ]}
    />
  );
}

// ─── Reusable: radar sweep line (rotating) ───
function RadarSweep({ color }: { color: string }) {
  const rot = useSharedValue(0);
  useEffect(() => {
    rot.value = withRepeat(withTiming(1, { duration: 3000, easing: Easing.linear }), -1, false);
  }, []);
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(rot.value, [0, 1], [0, 360])}deg` }],
  }));
  return (
    <Animated.View
      style={[
        { position: 'absolute', width: 220, height: 220, alignItems: 'center', justifyContent: 'center' },
        style,
      ]}
    >
      <LinearGradient
        colors={[color, 'transparent']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 110,
          height: 2,
          marginTop: -1,
          transformOrigin: 'left center' as any,
        }}
      />
    </Animated.View>
  );
}

// ─── Stacked-layers logo (matches mockup) ───
function StackedLogo({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Polygon points="12,3 21,7.5 12,12 3,7.5" fill={color} opacity={0.95} />
      <Polygon points="12,11 21,15.5 12,20 3,15.5" fill={color} opacity={0.65} />
      <Polygon points="12,15 21,19.5 12,24 3,19.5" fill={color} opacity={0.35} />
    </Svg>
  );
}

// ─── Animated horizontal scan line ───
function ScanLine({ color, height = 700 }: { color: string; height?: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1, false);
  }, []);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(t.value, [0, 1], [0, height]) }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', left: 0, right: 0, top: 0, height: 1.5 },
        style,
      ]}
    >
      <LinearGradient
        colors={['transparent', color, 'transparent'] as any}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ flex: 1, shadowColor: color, shadowOpacity: 0.8, shadowRadius: 12 }}
      />
    </Animated.View>
  );
}

// ─── Step 1: Welcome — radar ───
function StepWelcome({ colors }: { colors: ThemeColors }) {
  const styles = makeStyles(colors);
  return (
    <View style={{ flex: 1 }}>
      {/* Background: grid + radial glow */}
      <Svg style={{ position: 'absolute', width: '100%', height: '100%' }}>
        <Defs>
          <Pattern id="ow-grid" width={32} height={32} patternUnits="userSpaceOnUse">
            <Path d="M32 0H0v32" fill="none" stroke={colors.primary} strokeOpacity={0.08} strokeWidth={0.5} />
          </Pattern>
          <RadialGradient id="ow-glow" cx="50%" cy="40%" r="60%">
            <Stop offset="0%" stopColor={colors.primary} stopOpacity={0.4} />
            <Stop offset="100%" stopColor={colors.primary} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#ow-grid)" />
        <Rect width="100%" height="100%" fill="url(#ow-glow)" />
      </Svg>

      {/* Animated scan line */}
      <ScanLine color={colors.accent} />

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'space-between', paddingTop: 30, paddingBottom: 20 }}>
        {/* Brand */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <StackedLogo size={22} color={colors.primary} />
          <Text style={styles.wordmark}>SHADOWFIELD</Text>
        </View>

        {/* Radar */}
        <View style={styles.radarWrap}>
          {/* Outer halo ring */}
          <View
            style={{
              position: 'absolute',
              width: 320,
              height: 320,
              borderRadius: 160,
              borderWidth: 1,
              borderColor: colors.primary + '33',
              shadowColor: colors.primary,
              shadowOpacity: 0.6,
              shadowRadius: 40,
            }}
          />
          <PulseRing size={220} color={colors.primary} delay={0} />
          <PulseRing size={220} color={colors.primary} delay={800} />
          <PulseRing size={220} color={colors.accent} delay={1600} />

          <Svg width={220} height={220} viewBox="0 0 220 220" style={{ position: 'absolute' }}>
            <Circle cx={110} cy={110} r={100} fill="none" stroke={colors.primary} strokeOpacity={0.2} />
            <Circle cx={110} cy={110} r={70} fill="none" stroke={colors.primary} strokeOpacity={0.15} />
            <Circle cx={110} cy={110} r={40} fill="none" stroke={colors.primary} strokeOpacity={0.1} />
            <Line x1={10} y1={110} x2={210} y2={110} stroke={colors.primary} strokeOpacity={0.1} />
            <Line x1={110} y1={10} x2={110} y2={210} stroke={colors.primary} strokeOpacity={0.1} />
          </Svg>

          <RadarSweep color={colors.accent} />

          {/* Center stacked logo (no border box) */}
          <View style={{ zIndex: 2 }}>
            <StackedLogo size={64} color={colors.primary} />
          </View>

          {/* Hostile dots */}
          <View style={[styles.dot, { top: 50, right: 40, backgroundColor: colors.high, width: 8, height: 8, shadowColor: colors.high, shadowOpacity: 0.9, shadowRadius: 8 }]} />
          <View style={[styles.dot, { bottom: 60, left: 50, backgroundColor: colors.accent, width: 6, height: 6, shadowColor: colors.accent, shadowOpacity: 0.9, shadowRadius: 6 }]} />
          <View style={[styles.dot, { top: 70, left: 70, backgroundColor: colors.warning, width: 5, height: 5, shadowColor: colors.warning, shadowOpacity: 0.9, shadowRadius: 6 }]} />
        </View>

        {/* Copy */}
        <View style={{ alignItems: 'center', paddingHorizontal: spacing.xl }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <GlowDot color={colors.accent} size={6} />
            <MonoLabel color={colors.accent}>SYSTEM ONLINE</MonoLabel>
          </View>
          <Text style={styles.title}>See every</Text>
          <Text style={[styles.title, { color: colors.primary }]}>threat first.</Text>
          <Text style={styles.body}>Real-time perimeter intelligence for security operators and managers.</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Step 2: Live perimeter — tactical map ───
function StepPerimeter({ colors }: { colors: ThemeColors }) {
  const styles = makeStyles(colors);
  return (
    <View style={{ flex: 1, paddingHorizontal: spacing.xl }}>
      {/* Map tile */}
      <View style={styles.mapTile}>
        {/* Background radial glow (top-left) */}
        <Svg style={{ position: 'absolute', width: '100%', height: '100%' }}>
          <Defs>
            <RadialGradient id="map-glow" cx="30%" cy="40%" r="70%">
              <Stop offset="0%" stopColor={colors.surfaceMute} stopOpacity={1} />
              <Stop offset="100%" stopColor={colors.background} stopOpacity={1} />
            </RadialGradient>
            <Pattern id="op-g" width={24} height={24} patternUnits="userSpaceOnUse">
              <Path d="M24 0H0v24" fill="none" stroke={colors.primary} strokeOpacity={0.1} strokeWidth={0.5} />
            </Pattern>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#map-glow)" />
          <Rect width="100%" height="100%" fill="url(#op-g)" />
          <Path
            d="M0 80 Q80 60 200 100 T312 140"
            stroke={colors.primary}
            strokeOpacity={0.3}
            strokeWidth={1.2}
            fill="none"
          />
          <Path
            d="M0 200 Q120 180 200 220 T312 240"
            stroke={colors.primary}
            strokeOpacity={0.3}
            strokeWidth={1.2}
            fill="none"
          />
          <Path d="M120 0 L130 320" stroke={colors.accent} strokeOpacity={0.2} strokeWidth={1} fill="none" />
          <Path d="M220 0 L210 320" stroke={colors.accent} strokeOpacity={0.2} strokeWidth={1} fill="none" />
          {/* Perimeter polygon */}
          <Polygon
            points="60,80 240,60 270,200 200,260 80,250 50,160"
            fill={colors.primary}
            fillOpacity={0.08}
            stroke={colors.primary}
            strokeOpacity={0.6}
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
        </Svg>

        {/* Pulsing main pin (centered in 60x60 anchor so the ring isn't clipped) */}
        <View style={{ position: 'absolute', top: 110, left: 130, width: 60, height: 60, alignItems: 'center', justifyContent: 'center' }}>
          <PulseRing size={50} color={colors.high} delay={0} />
          <PulseRing size={50} color={colors.high} delay={1200} />
          <View style={[styles.mapPin, { backgroundColor: colors.high, shadowColor: colors.high }]} />
        </View>
        {/* Static pins */}
        <View style={[styles.smallPin, { top: 90, left: 220, backgroundColor: colors.accent, shadowColor: colors.accent }]} />
        <View style={[styles.smallPin, { top: 200, left: 90, backgroundColor: colors.warning, shadowColor: colors.warning }]} />

        {/* Top chip */}
        <View style={styles.topChip}>
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6 }}>
            <GlowDot color={colors.accent} size={5} />
            <MonoLabel color={colors.accent}>ZONE A · LIVE</MonoLabel>
          </View>
        </View>

        {/* Bottom info chip */}
        <View style={styles.bottomChip}>
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 }}>
            <View>
              <MonoLabel color={colors.textSecondary}>SUSPICIOUS · ZONE A</MonoLabel>
              <Text style={{ ...typography.label, color: colors.text, marginTop: 2 }}>
                Unidentified person · 0:42 ago
              </Text>
            </View>
            <View style={[styles.sevPill, { backgroundColor: colors.highBg, borderColor: colors.high + '66' }]}>
              <View style={[styles.sevDot, { backgroundColor: colors.high }]} />
              <Text style={{ fontSize: 10, fontWeight: '700', color: colors.high, letterSpacing: 1 }}>HIGH</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Copy */}
      <View style={{ marginTop: spacing.xl }}>
        <Text style={styles.title2}>Live perimeter,</Text>
        <Text style={styles.title2}>down to the meter.</Text>
        <Text style={[styles.body, { textAlign: 'left', marginTop: spacing.sm }]}>
          Track every guard, every alert, every zone in real time. Suspicious activity surfaces instantly.
        </Text>
      </View>
    </View>
  );
}

// ─── Step 3: Instant alerts — fanned notification card stack ───
function StepAlerts({ colors }: { colors: ThemeColors }) {
  const styles = makeStyles(colors);
  const cards: {
    sev: string;
    sevLabel: string;
    title: string;
    sub: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
  }[] = [
    { sev: 'critical', sevLabel: 'CRITICAL', title: 'Breach detected', sub: 'Perimeter · Zone C · now', icon: 'warning', color: colors.critical },
    { sev: 'high', sevLabel: 'HIGH', title: 'Suspicious activity', sub: 'Unidentified · Zone A · 0:42 ago', icon: 'alert-circle', color: colors.high },
    { sev: 'medium', sevLabel: 'MEDIUM', title: 'Guard check-in late', sub: 'J. Patel · Zone D · 2m ago', icon: 'time', color: colors.warning },
  ];

  return (
    <View style={{ flex: 1, paddingHorizontal: spacing.xl }}>
      <View style={styles.alertStack}>
        {cards.map((c, i) => {
          const isTop = i === 0;
          const rot = (i - 1) * 3; // -3, 0, 3 degrees
          return (
            <Animated.View
              key={i}
              entering={FadeIn.delay(i * 120)}
              style={[
                styles.alertCard,
                {
                  top: 10 + i * 28,
                  transform: [{ rotate: `${rot}deg` }],
                  zIndex: cards.length - i,
                  borderColor: isTop ? c.color + '55' : colors.border,
                  shadowColor: isTop ? c.color : '#000',
                  shadowOpacity: isTop ? 0.35 : 0.25,
                },
              ]}
            >
              <View style={styles.alertIconWrap}>
                {isTop && <PulseRing size={54} color={c.color} delay={0} />}
                {isTop && <PulseRing size={54} color={c.color} delay={1100} />}
                <View
                  style={[
                    styles.alertIcon,
                    {
                      backgroundColor: c.color + '22',
                      borderColor: c.color + '66',
                    },
                  ]}
                >
                  <Ionicons name={c.icon} size={18} color={c.color} />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...typography.label, color: colors.text }} numberOfLines={1}>{c.title}</Text>
                <Text style={{ ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>{c.sub}</Text>
              </View>
              <View style={[styles.alertSevPill, { backgroundColor: c.color + '22', borderColor: c.color + '66' }]}>
                <Text style={{ fontSize: 9, fontWeight: '800', color: c.color, letterSpacing: 1 }}>{c.sevLabel}</Text>
              </View>
            </Animated.View>
          );
        })}
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <Text style={styles.title2}>Know before</Text>
        <Text style={[styles.title2, { color: colors.primary }]}>it escalates.</Text>
        <Text style={[styles.body, { textAlign: 'left', marginTop: spacing.sm }]}>
          Critical, high, medium — severity-scored alerts with pulse indicators. Acknowledge with one tap.
        </Text>
      </View>
    </View>
  );
}

// ─── Typing dot for chat step ───
function TypingDot({ color, delay }: { color: string; delay: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }), -1, true),
    );
  }, [delay]);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 1], [0.3, 1]),
    transform: [{ scale: interpolate(t.value, [0, 1], [0.8, 1.2]) }],
  }));
  return <Animated.View style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }, style]} />;
}

// ─── Step 4: Team dispatch — chat bubbles + avatars + typing indicator ───
function StepChat({ colors }: { colors: ThemeColors }) {
  const styles = makeStyles(colors);
  const avatarColors = [colors.primary, colors.accent, colors.high, colors.warning];

  return (
    <View style={{ flex: 1, paddingHorizontal: spacing.xl }}>
      <View style={styles.chatPanel}>
        {/* Team avatars row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
          {avatarColors.map((c, i) => (
            <View
              key={i}
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                backgroundColor: c,
                marginLeft: i === 0 ? 0 : -8,
                borderWidth: 2,
                borderColor: colors.surface,
              }}
            />
          ))}
          <View style={{ marginLeft: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <GlowDot color={colors.success} size={5} />
            <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textSecondary, letterSpacing: 1.5 }}>
              OPS · 4 ONLINE
            </Text>
          </View>
        </View>

        {/* Incoming bubble */}
        <Animated.View
          entering={FadeIn.delay(120)}
          style={[styles.bubbleIn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
        >
          <Text style={{ ...typography.bodySmall, color: colors.text, lineHeight: 18 }}>
            Roger, on my way to Zone A.
          </Text>
          <Text style={{ fontSize: 9, color: colors.textMute, marginTop: 4, letterSpacing: 1 }}>
            ALEX · 09:41
          </Text>
        </Animated.View>

        {/* Outgoing gradient bubble */}
        <Animated.View entering={FadeIn.delay(300)} style={styles.bubbleOutWrap}>
          <LinearGradient
            colors={[colors.primary, colors.accent] as any}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.bubbleOut}
          >
            <Text style={{ ...typography.bodySmall, color: '#fff', lineHeight: 18 }}>
              Suspicious individual near Gate 3. Need backup.
            </Text>
          </LinearGradient>
        </Animated.View>

        {/* Typing indicator */}
        <Animated.View
          entering={FadeIn.delay(500)}
          style={[styles.typingBubble, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
        >
          <TypingDot color={colors.textSecondary} delay={0} />
          <TypingDot color={colors.textSecondary} delay={180} />
          <TypingDot color={colors.textSecondary} delay={360} />
        </Animated.View>
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <Text style={styles.title2}>Stay in sync</Text>
        <Text style={[styles.title2, { color: colors.primary }]}>under pressure.</Text>
        <Text style={[styles.body, { textAlign: 'left', marginTop: spacing.sm }]}>
          Coordinate with dispatchers and field teams in real time. Voice notes, pinned locations, broadcasts.
        </Text>
      </View>
    </View>
  );
}

// ─── Main screen ───
export default function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [step, setStep] = useState(0);
  const isLast = step === 3;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Step indicator (hidden on welcome) */}
      {step > 0 && (
        <View style={styles.stepBar}>
          {[0, 1, 2, 3].map(i => (
            <View
              key={i}
              style={[
                styles.stepPill,
                {
                  backgroundColor:
                    i < step ? colors.textMute : i === step ? colors.primary : colors.surfaceMute,
                  shadowColor: colors.primary,
                  shadowOpacity: i === step ? 0.6 : 0,
                  shadowRadius: 6,
                },
              ]}
            />
          ))}
          <View style={{ flex: 1 }} />
          <MonoLabel color={colors.textMute}>{`0${step + 1} / 04`}</MonoLabel>
        </View>
      )}

      {/* Step content */}
      <View style={{ flex: 1 }}>
        {step === 0 && <StepWelcome colors={colors} />}
        {step === 1 && <StepPerimeter colors={colors} />}
        {step === 2 && <StepAlerts colors={colors} />}
        {step === 3 && <StepChat colors={colors} />}
      </View>

      {/* CTA row */}
      <View style={styles.cta}>
        {step === 0 ? (
          <>
            <GradientButton title="GET STARTED →" onPress={() => setStep(1)} />
            <Text style={{ ...typography.bodySmall, color: colors.textTertiary, textAlign: 'center', marginTop: 12 }}>
              Have an account?{' '}
              <Text style={{ color: colors.primary, fontWeight: '600' }}>Sign in</Text>
            </Text>
          </>
        ) : (
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <GradientButton
                title="SKIP"
                variant="ghost"
                onPress={() => (isLast ? onDone() : setStep(s => s + 1))}
              />
            </View>
            <View style={{ flex: 2 }}>
              <GradientButton
                title={isLast ? 'ENTER FIELD →' : 'CONTINUE'}
                onPress={() => (isLast ? onDone() : setStep(s => s + 1))}
              />
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───
const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    stepBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      paddingBottom: spacing.lg,
    },
    stepPill: { width: 24, height: 3, borderRadius: 2 },
    logoBox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.primary + '66',
      alignItems: 'center',
      justifyContent: 'center',
    },
    wordmark: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 3,
      color: colors.text,
    },
    radarWrap: {
      width: 240,
      height: 240,
      alignItems: 'center',
      justifyContent: 'center',
    },
    centerLogo: {
      width: 64,
      height: 64,
      borderRadius: 16,
      borderWidth: 1,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2,
    },
    dot: { position: 'absolute', borderRadius: 999 },
    title: {
      ...typography.display,
      color: colors.text,
      textAlign: 'center',
      lineHeight: 38,
    },
    title2: {
      ...typography.h1,
      color: colors.text,
      lineHeight: 30,
    },
    body: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: spacing.md,
    },
    mapTile: {
      height: 320,
      borderRadius: radius.xl,
      overflow: 'hidden',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    mapPin: {
      width: 16,
      height: 16,
      borderRadius: 8,
      shadowOpacity: 0.8,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 0 },
      elevation: 6,
    },
    smallPin: {
      position: 'absolute',
      width: 10,
      height: 10,
      borderRadius: 5,
      shadowOpacity: 0.8,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 0 },
      elevation: 4,
    },
    topChip: {
      position: 'absolute',
      top: 14,
      left: 14,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      overflow: 'hidden',
    },
    bottomChip: {
      position: 'absolute',
      bottom: 14,
      left: 14,
      right: 14,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    sevPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      borderWidth: 1,
    },
    sevDot: { width: 5, height: 5, borderRadius: 2.5 },
    // Step 3 — alert stack
    alertStack: {
      height: 220,
      position: 'relative',
      marginTop: spacing.md,
    },
    alertCard: {
      position: 'absolute',
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    alertIconWrap: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    alertIcon: {
      width: 38,
      height: 38,
      borderRadius: 10,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    alertSevPill: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      borderWidth: 1,
    },
    // Step 4 — chat
    chatPanel: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      marginTop: spacing.sm,
    },
    bubbleIn: {
      alignSelf: 'flex-start',
      maxWidth: '80%',
      padding: 11,
      borderRadius: 14,
      borderWidth: 1,
      marginBottom: spacing.sm,
    },
    bubbleOutWrap: {
      alignSelf: 'flex-end',
      maxWidth: '85%',
      marginBottom: spacing.sm,
    },
    bubbleOut: {
      padding: 12,
      borderRadius: 14,
    },
    typingBubble: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      gap: 4,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 14,
      borderWidth: 1,
    },
    cta: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      paddingBottom: spacing.lg,
    },
  });
