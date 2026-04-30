// ShadowField Mobile Design System — v2 (Tactical Dark + Refined Light)
//
// Drop-in replacement for the existing src/theme.ts.
// Same exported API: colors, spacing, radius, typography, shadow.
// Now also exports: lightColors, darkColors, type ThemeMode, type ThemeColors
// and a `getThemeColors(mode)` helper.
//
// `colors` is exported as the *dark* palette by default so existing imports keep
// working. Wrap screens in <ThemeProvider> and use `useThemeColors()` to react
// to user preference changes.

// ─── Dark palette (default — tactical / ops) ───
export const darkColors = {
  // Brand accents
  primary: '#A78BFA',          // violet
  primaryDark: '#8B5CF6',
  primaryLight: 'rgba(167,139,250,0.18)',
  primaryText: '#C4B5FD',
  accent: '#22D3EE',           // cyan
  accentMagenta: '#F472B6',

  // Backgrounds (layered dark)
  background: '#0A0A14',       // bg0 — base app background
  surface: '#11142A',          // bg1 — cards
  surfaceElevated: '#1A1F36',  // bg2 — elevated cards / sheets
  surfaceMute: '#222842',      // bg3 — input fields, deep wells

  // Text
  text: '#EDEEF7',
  textSecondary: '#A8AED0',
  textTertiary: '#7A82A8',
  textInverse: '#0A0A14',
  textMute: '#5A6090',

  // Borders / hairlines
  border: 'rgba(167,139,250,0.18)',
  borderLight: 'rgba(167,139,250,0.10)',
  borderStrong: 'rgba(167,139,250,0.32)',

  // Status
  success: '#34E2A1',
  warning: '#FBBF24',
  error: '#FB4D6E',
  info: '#22D3EE',
  critical: '#FB4D6E',
  high: '#F472B6',
  medium: '#FBBF24',
  low: '#22D3EE',

  // Header / nav
  headerBg: '#0A0A14',
  tabBar: 'rgba(17,20,42,0.72)',     // glass — pair with BlurView
  tabBarBorder: 'rgba(167,139,250,0.18)',
  tabActive: '#A78BFA',
  tabInactive: '#5A6090',

  // Overlays for glass / blur tinting
  overlayBg: 'rgba(17,20,42,0.72)',
  overlayBgStrong: 'rgba(10,10,20,0.86)',

  // Shadows base
  cardShadow: '#000000',

  // Convenience semantics for severity backgrounds
  criticalBg: 'rgba(251,77,110,0.16)',
  highBg: 'rgba(244,114,182,0.16)',
  mediumBg: 'rgba(251,191,36,0.14)',
  lowBg: 'rgba(34,211,238,0.14)',
  successBg: 'rgba(52,226,161,0.14)',

  isDark: true,
} as const;

// ─── Light palette (refined — for managers, daytime use) ───
export const lightColors = {
  primary: '#7C3AED',
  primaryDark: '#6D28D9',
  primaryLight: 'rgba(124,58,237,0.10)',
  primaryText: '#5B21B6',
  accent: '#0891B2',
  accentMagenta: '#DB2777',

  background: '#FAFAFC',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceMute: '#F1F2F7',

  text: '#0F1024',
  textSecondary: '#4A4F6E',
  textTertiary: '#7B7F9A',
  textInverse: '#FFFFFF',
  textMute: '#A0A4BD',

  border: '#E5E6EE',
  borderLight: '#EFF0F5',
  borderStrong: '#D6D8E2',

  success: '#10B981',
  warning: '#D97706',
  error: '#E11D48',
  info: '#0891B2',
  critical: '#E11D48',
  high: '#DB2777',
  medium: '#D97706',
  low: '#0891B2',

  headerBg: '#FFFFFF',
  tabBar: 'rgba(255,255,255,0.86)',
  tabBarBorder: '#E5E6EE',
  tabActive: '#7C3AED',
  tabInactive: '#7B7F9A',

  overlayBg: 'rgba(255,255,255,0.86)',
  overlayBgStrong: 'rgba(255,255,255,0.96)',

  cardShadow: '#000000',

  criticalBg: 'rgba(225,29,72,0.10)',
  highBg: 'rgba(219,39,119,0.10)',
  mediumBg: 'rgba(217,119,6,0.10)',
  lowBg: 'rgba(8,145,178,0.10)',
  successBg: 'rgba(16,185,129,0.10)',

  isDark: false,
} as const;

export type ThemeColors = typeof darkColors;
export type ThemeMode = 'dark' | 'light';

export function getThemeColors(mode: ThemeMode): ThemeColors {
  return (mode === 'light' ? lightColors : darkColors) as ThemeColors;
}

// Default export = dark, so existing imports `import { colors } from '../theme'`
// keep compiling. Components should switch to `useThemeColors()` from
// ThemeContext to react to toggle changes at runtime.
export const colors = darkColors;

// ─── Spacing (unchanged keys) ───
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

// ─── Radius — slightly bigger to match the tactical/glass look ───
export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 22,
  full: 999,
} as const;

// ─── Typography — pulled toward the design's display feel ───
// We don't ship custom fonts here; the system font stack is used. If/when
// you want to load Space Grotesk + JetBrains Mono via expo-font, swap the
// fontFamily values below.
export const typography = {
  display: { fontSize: 32, fontWeight: '700' as const, letterSpacing: -1 },
  h1:      { fontSize: 26, fontWeight: '700' as const, letterSpacing: -0.5 },
  h2:      { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3 },
  h3:      { fontSize: 17, fontWeight: '600' as const, letterSpacing: -0.1 },
  body:    { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  bodySmall: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  caption: { fontSize: 11, fontWeight: '500' as const, letterSpacing: 0.4 },
  label:   { fontSize: 13, fontWeight: '600' as const },
  // Monospaced for codes, IDs, timestamps — matches the tactical aesthetic
  mono:    { fontSize: 11, fontWeight: '500' as const, letterSpacing: 1.2,
             fontFamily: 'Courier New' /* swap for 'JetBrainsMono' if loaded */ },
  monoLg:  { fontSize: 13, fontWeight: '600' as const, letterSpacing: 1,
             fontFamily: 'Courier New' },
} as const;

// ─── Shadows — softer in light, glow-tinted in dark ───
export const shadow = {
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 5,
  },
  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 10,
  },
  // Brand-tinted glow for hero CTAs / active states (use ONLY for accent surfaces)
  glow: {
    shadowColor: '#A78BFA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 8,
  },
  glowDanger: {
    shadowColor: '#FB4D6E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 8,
  },
} as const;

// ─── Gradient stops (use with expo-linear-gradient) ───
export const gradients = {
  brand: ['#A78BFA', '#22D3EE'] as const,           // violet → cyan
  brandSoft: ['rgba(167,139,250,0.16)', 'rgba(34,211,238,0.08)'] as const,
  danger: ['#FB4D6E', '#F472B6'] as const,
  success: ['#34E2A1', '#22D3EE'] as const,
  surface: ['rgba(26,31,54,0.6)', 'rgba(17,20,42,0.6)'] as const,
  surfaceLight: ['#FFFFFF', '#F7F8FC'] as const,
} as const;
