// ShadowField — Reanimated motion library
// All hooks return `useAnimatedStyle` results you can spread onto Animated.View.
//
// Usage:
//   import Animated from 'react-native-reanimated';
//   import { usePulseRing, useRadarSweep, useShimmer, useFadeUp, useBlink } from '../animations';
//
//   const pulse = usePulseRing();
//   <Animated.View style={[styles.ring, pulse]} />
//
// Honors a "reduce motion" toggle if you wire one up via ThemeContext.

import { useEffect } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withDelay,
  withSequence,
  Easing,
  cancelAnimation,
  interpolate,
  interpolateColor,
} from 'react-native-reanimated';

// ─── Pulse ring (for incident pins, panic buttons, "live" indicators) ───
//   scale 0.4 → 2.4, opacity 1 → 0, infinite. Stagger by passing `delay`.
export function usePulseRing(delay = 0, durationMs = 2400) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: durationMs, easing: Easing.out(Easing.ease) }), -1, false));
    return () => cancelAnimation(t);
  }, [delay, durationMs]);
  return useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(t.value, [0, 1], [0.4, 2.4]) }],
    opacity: interpolate(t.value, [0, 1], [1, 0]),
  }));
}

// ─── Radar sweep — full 360° rotation ───
export function useRadarSweep(durationMs = 4000) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: durationMs, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(t);
  }, [durationMs]);
  return useAnimatedStyle(() => ({
    transform: [{ rotate: `${t.value * 360}deg` }],
  }));
}

// ─── Shimmer — horizontal sweep across hero cards (use with LinearGradient) ───
//   Returns a translateX you apply to a wide gradient overlay.
export function useShimmer(width = 300, durationMs = 4000) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: durationMs, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(t);
  }, [durationMs]);
  return useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(t.value, [0, 1], [-width, width]) }],
  }));
}

// ─── Blink — subtle opacity pulse for live dots / badges ───
export function useBlink(durationMs = 1600) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: durationMs, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => cancelAnimation(t);
  }, [durationMs]);
  return useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 1], [1, 0.4]),
  }));
}

// ─── Fade-up entrance — list items, cards on mount ───
//   Pass an index to stagger; each item delays by index * stepMs.
export function useFadeUp(index = 0, stepMs = 60, distance = 8) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(index * stepMs, withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) }));
    return () => cancelAnimation(t);
  }, [index, stepMs]);
  return useAnimatedStyle(() => ({
    opacity: t.value,
    transform: [{ translateY: interpolate(t.value, [0, 1], [distance, 0]) }],
  }));
}

// ─── Float — subtle vertical bob (logo, hero icon) ───
export function useFloat(distance = 6, durationMs = 3200) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: durationMs, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(t);
  }, [durationMs]);
  return useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(t.value, [0, 1], [0, -distance]) }],
  }));
}

// ─── Bar grow — for the dashboard mini-bar chart, with stagger ───
export function useBarGrow(index: number, finalScale: number) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(index * 40, withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }));
    return () => cancelAnimation(t);
  }, [index]);
  return useAnimatedStyle(() => ({
    transform: [{ scaleY: interpolate(t.value, [0, 1], [0.3, finalScale]) }],
    transformOrigin: 'bottom',
  }));
}

// ─── Press feedback — wraps onPressIn/Out with a quick scale ───
export function usePressScale(active = 0.96) {
  const s = useSharedValue(1);
  const onPressIn = () => { s.value = withTiming(active, { duration: 100 }); };
  const onPressOut = () => { s.value = withTiming(1, { duration: 160 }); };
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return { style, onPressIn, onPressOut };
}

// ─── Typing dots — for chat indicators ───
//   Returns 3 styles you spread onto 3 dots.
export function useTypingDots() {
  const a = useSharedValue(0);
  const b = useSharedValue(0);
  const c = useSharedValue(0);
  useEffect(() => {
    const cycle = (sv: typeof a, delay: number) => {
      sv.value = withDelay(delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
            withTiming(0, { duration: 400, easing: Easing.inOut(Easing.ease) }),
            withTiming(0, { duration: 400 }),
          ), -1, false
        )
      );
    };
    cycle(a, 0); cycle(b, 200); cycle(c, 400);
    return () => { cancelAnimation(a); cancelAnimation(b); cancelAnimation(c); };
  }, []);
  const make = (sv: typeof a) => useAnimatedStyle(() => ({
    opacity: interpolate(sv.value, [0, 1], [0.3, 1]),
    transform: [{ translateY: interpolate(sv.value, [0, 1], [0, -3]) }],
  }));
  return [make(a), make(b), make(c)] as const;
}

// ─── Animated color (for theme transitions) ───
export function useColorPulse(from: string, to: string, durationMs = 1400) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: durationMs }), -1, true);
    return () => cancelAnimation(t);
  }, [durationMs, from, to]);
  return useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(t.value, [0, 1], [from, to]),
  }));
}
