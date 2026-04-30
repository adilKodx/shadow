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
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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

// ─── Step 1: Welcome — radar ───
function StepWelcome({ colors }: { colors: ThemeColors }) {
  const styles = makeStyles(colors);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'space-between', paddingTop: 30 }}>
      {/* Brand */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={styles.logoBox}>
          <Svg width="14" height="14" viewBox="0 0 14 14">
            <Polygon points="7,1 13,4 13,10 7,13 1,10 1,4" fill={colors.primary} opacity={0.9} />
          </Svg>
        </View>
        <Text style={styles.wordmark}>SHADOWFIELD</Text>
      </View>

      {/* Radar */}
      <View style={styles.radarWrap}>
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

        {/* Center logo */}
        <View style={[styles.centerLogo, { borderColor: colors.primary + '88' }]}>
          <Svg width="36" height="36" viewBox="0 0 14 14">
            <Polygon points="7,1 13,4 13,10 7,13 1,10 1,4" fill={colors.primary} />
          </Svg>
        </View>

        {/* Hostile dots */}
        <View style={[styles.dot, { top: 50, right: 40, backgroundColor: colors.high, width: 8, height: 8 }]} />
        <View style={[styles.dot, { bottom: 60, left: 50, backgroundColor: colors.accent, width: 6, height: 6 }]} />
        <View style={[styles.dot, { top: 70, left: 70, backgroundColor: colors.warning, width: 5, height: 5 }]} />
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
  );
}

// ─── Step 2: Live perimeter — tactical map ───
function StepPerimeter({ colors }: { colors: ThemeColors }) {
  const styles = makeStyles(colors);
  return (
    <View style={{ flex: 1, paddingHorizontal: spacing.xl }}>
      {/* Map tile */}
      <View style={styles.mapTile}>
        {/* Grid + roads */}
        <Svg style={{ position: 'absolute', width: '100%', height: '100%' }}>
          <Defs>
            <Pattern id="op-g" width={24} height={24} patternUnits="userSpaceOnUse">
              <Path d="M24 0H0v24" fill="none" stroke={colors.primary} strokeOpacity={0.1} strokeWidth={0.5} />
            </Pattern>
          </Defs>
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

        {/* Pulsing main pin */}
        <View style={{ position: 'absolute', top: 130, left: 140, width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}>
          <PulseRing size={50} color={colors.high} />
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

// ─── Step 3: Permissions ───
function StepPermissions({ colors }: { colors: ThemeColors }) {
  const styles = makeStyles(colors);
  const [perms, setPerms] = useState([
    { name: 'Location', desc: 'Live patrol tracking & geofence alerts', color: colors.accent, on: true },
    { name: 'Notifications', desc: 'Critical alerts, even on silent', color: colors.primary, on: true },
    { name: 'Camera', desc: 'Attach photo evidence to incidents', color: colors.high, on: false },
    { name: 'Background', desc: 'Stay online during patrol', color: colors.warning, on: true },
  ]);
  const toggle = (i: number) =>
    setPerms(p => p.map((x, idx) => (idx === i ? { ...x, on: !x.on } : x)));

  return (
    <View style={{ flex: 1, paddingHorizontal: spacing.xl }}>
      <Text style={styles.title2}>Grant access</Text>
      <Text style={styles.title2}>to your field kit.</Text>
      <Text style={[styles.body, { textAlign: 'left', marginTop: spacing.sm, marginBottom: spacing.xl }]}>
        We only use what you allow. You can change these later in Settings.
      </Text>
      <View style={{ gap: 10 }}>
        {perms.map((p, i) => (
          <Animated.View
            key={p.name}
            entering={FadeIn.delay(i * 80)}
            style={[
              styles.permCard,
              { borderColor: p.on ? p.color + '55' : colors.border },
            ]}
          >
            <View
              style={[
                styles.permIcon,
                {
                  backgroundColor: p.color + '22',
                  borderColor: p.color + '55',
                  shadowColor: p.color,
                  shadowOpacity: p.on ? 0.4 : 0,
                  shadowRadius: 12,
                },
              ]}
            >
              <View style={[styles.permGlyph, { backgroundColor: p.color }]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...typography.label, color: colors.text }}>{p.name}</Text>
              <Text style={{ ...typography.bodySmall, color: colors.textSecondary, marginTop: 1 }}>{p.desc}</Text>
            </View>
            <Switch
              value={p.on}
              onValueChange={() => toggle(i)}
              trackColor={{ true: p.color, false: colors.surfaceMute }}
              thumbColor="#fff"
            />
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

// ─── Step 4: Role select ───
function StepRole({
  colors,
  role,
  setRole,
}: { colors: ThemeColors; role: 'operator' | 'manager'; setRole: (r: 'operator' | 'manager') => void }) {
  const styles = makeStyles(colors);
  const cards: { id: 'operator' | 'manager'; title: string; desc: string }[] = [
    { id: 'operator', title: 'Operator', desc: 'Field guard. See alerts, your patrol, your zone.' },
    { id: 'manager', title: 'Manager', desc: 'Run the room. All zones, all teams, all data.' },
  ];
  return (
    <View style={{ flex: 1, paddingHorizontal: spacing.xl }}>
      <Text style={styles.title2}>Choose your role.</Text>
      <Text style={[styles.body, { textAlign: 'left', marginTop: spacing.sm, marginBottom: spacing.xl }]}>
        We'll customize the dashboard for how you work.
      </Text>
      <View style={{ gap: 12 }}>
        {cards.map(c => {
          const selected = role === c.id;
          return (
            <TouchableOpacity
              key={c.id}
              onPress={() => setRole(c.id)}
              activeOpacity={0.85}
              style={[
                styles.roleCard,
                {
                  borderColor: selected ? colors.primary : colors.border,
                  shadowColor: colors.primary,
                  shadowOpacity: selected ? 0.3 : 0,
                  shadowRadius: 18,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ ...typography.h2, color: colors.text }}>{c.title}</Text>
                <Text style={{ ...typography.body, color: colors.textSecondary, marginTop: 4 }}>{c.desc}</Text>
              </View>
              <View
                style={[
                  styles.radio,
                  { borderColor: selected ? colors.primary : colors.border },
                ]}
              >
                {selected && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Main screen ───
export default function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<'operator' | 'manager'>('operator');
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
        {step === 2 && <StepPermissions colors={colors} />}
        {step === 3 && <StepRole colors={colors} role={role} setRole={setRole} />}
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
    permCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: 14,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
    },
    permIcon: {
      width: 40,
      height: 40,
      borderRadius: 10,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      shadowOffset: { width: 0, height: 0 },
      elevation: 4,
    },
    permGlyph: {
      width: 14,
      height: 14,
      borderRadius: 4,
      opacity: 0.9,
    },
    roleCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
    },
    radio: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: spacing.md,
    },
    radioInner: { width: 12, height: 12, borderRadius: 6 },
    cta: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      paddingBottom: spacing.lg,
    },
  });
