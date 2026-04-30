// OnboardingScreen.tsx — NEW (4-step intro shown to first-time users)
//
// To wire this up, edit packages/mobile/App.tsx RootNavigator:
//
//   const [seenOnboarding, setSeenOnboarding] = useState<boolean | null>(null);
//   useEffect(() => {
//     AsyncStorage.getItem('shadowfield.onboarding.done').then(v =>
//       setSeenOnboarding(v === '1')
//     );
//   }, []);
//   if (seenOnboarding === null) return <LoadingScreen />;
//
//   // Then in the navigator:
//   {!seenOnboarding ? (
//     <Stack.Screen name="Onboarding">
//       {(props) => <OnboardingScreen {...props} onDone={() => {
//         AsyncStorage.setItem('shadowfield.onboarding.done', '1');
//         setSeenOnboarding(true);
//       }} />}
//     </Stack.Screen>
//   ) : user && tenant ? (
//     <Stack.Screen name="Main" component={DrawerNav} />
//   ) : (
//     <Stack.Screen name="Login" component={LoginScreen} />
//   )}

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { spacing, radius, typography, gradients, type ThemeColors } from '../theme';
import { useThemeColors, useIsDark } from '../context/ThemeContext';
import { useFadeUp, useFloat, usePulseRing } from '../animations';
import { GradientButton, MonoLabel, GlowDot } from '../components/ui';

const { width: SCREEN_W } = Dimensions.get('window');

type Step = {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  eyebrow: string;
  title: string;
  body: string;
};

const STEPS = (colors: ThemeColors): Step[] => [
  {
    icon: 'shield-checkmark',
    iconColor: colors.primary,
    eyebrow: 'WELCOME TO SHADOWFIELD',
    title: 'Your zone.\nOur eyes.',
    body: 'Real-time situational awareness for security operators and managers. Built for teams who can\'t miss a beat.',
  },
  {
    icon: 'map',
    iconColor: colors.accent,
    eyebrow: 'LIVE TACTICAL MAP',
    title: 'Every incident,\non one map.',
    body: 'See active alerts, team positions, and zone perimeters in real time. Tap any pin for details.',
  },
  {
    icon: 'notifications',
    iconColor: colors.warning,
    eyebrow: 'INSTANT ALERTS',
    title: 'Know before\nit escalates.',
    body: 'Push notifications for suspicious activity, panic events, and zone breaches. Acknowledge with one tap.',
  },
  {
    icon: 'chatbubbles',
    iconColor: colors.success,
    eyebrow: 'TEAM DISPATCH',
    title: 'Stay in sync\nunder pressure.',
    body: 'Coordinate with dispatchers and field teams in real time. Voice notes, location pins, and broadcasts.',
  },
];

export default function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const colors = useThemeColors();
  const isDark = useIsDark();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [step, setStep] = useState(0);

  const steps = STEPS(colors);
  const current = steps[step];
  const isLast = step === steps.length - 1;

  const titleFade = useFadeUp(0);
  const bodyFade = useFadeUp(1, 80);
  const float = useFloat(8);
  const pulse1 = usePulseRing(0);
  const pulse2 = usePulseRing(800);

  const next = () => {
    if (isLast) onDone();
    else setStep(s => s + 1);
  };
  const back = () => setStep(s => Math.max(0, s - 1));
  const skip = () => onDone();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Ambient glows */}
      {isDark && (
        <>
          <View style={[styles.glow, { top: -150, right: -100, backgroundColor: current.iconColor }]} />
          <View style={[styles.glow, { bottom: -100, left: -150, backgroundColor: colors.primary, opacity: 0.10 }]} />
        </>
      )}

      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <GlowDot color={colors.success} size={6} />
          <MonoLabel>SECURE · v1.0.0</MonoLabel>
        </View>
        {!isLast && (
          <TouchableOpacity onPress={skip} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <MonoLabel color={colors.textSecondary}>SKIP →</MonoLabel>
          </TouchableOpacity>
        )}
      </View>

      {/* Hero icon area */}
      <View style={styles.hero}>
        <Animated.View style={[styles.heroIconWrap, float]} key={step}>
          {/* Pulse rings */}
          <View style={styles.pulseAnchor}>
            <Animated.View style={[styles.pulseRing, { borderColor: current.iconColor }, pulse1]} />
            <Animated.View style={[styles.pulseRing, { borderColor: current.iconColor }, pulse2]} />
          </View>
          <LinearGradient
            colors={[current.iconColor + '44', current.iconColor + '11'] as any}
            style={styles.heroIcon}
          >
            <Ionicons name={current.icon} size={56} color={current.iconColor} />
          </LinearGradient>
        </Animated.View>
      </View>

      {/* Copy */}
      <View style={styles.copy}>
        <Animated.View style={titleFade} key={`eb-${step}`} entering={FadeIn} exiting={FadeOut}>
          <MonoLabel color={current.iconColor}>{current.eyebrow}</MonoLabel>
        </Animated.View>
        <Animated.Text style={[styles.title, titleFade]} key={`title-${step}`}>
          {current.title}
        </Animated.Text>
        <Animated.Text style={[styles.body, bodyFade]} key={`body-${step}`}>
          {current.body}
        </Animated.Text>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        {/* Step dots */}
        <View style={styles.dots}>
          {steps.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === step
                  ? { backgroundColor: colors.primary, width: 24 }
                  : { backgroundColor: colors.borderStrong },
              ]}
            />
          ))}
        </View>

        {/* Buttons */}
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          {step > 0 && (
            <TouchableOpacity onPress={back} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color={colors.text} />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <GradientButton
              title={isLast ? 'GET STARTED →' : 'NEXT'}
              onPress={next}
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  glow: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    opacity: 0.18,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroIconWrap: {
    width: 160,
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseAnchor: {
    position: 'absolute',
    width: 160,
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1.5,
  },
  heroIcon: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  copy: {
    paddingHorizontal: spacing.xxl,
    marginBottom: spacing.xxl,
    minHeight: 200,
  },
  title: {
    ...typography.display,
    fontSize: 38,
    color: colors.text,
    marginTop: 12,
    marginBottom: 16,
    lineHeight: 44,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: spacing.md,
  },
  dot: {
    height: 6,
    width: 6,
    borderRadius: 3,
  },
  backBtn: {
    width: 50,
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
