# Convert LoginScreen.tsx

You are working in `packages/mobile/src/screens/LoginScreen.tsx`. The foundation files (`theme.ts`, `animations.ts`, `context/ThemeContext.tsx`, `components/ui/index.tsx`) have already been added to the project.

## Goal

Replace the current LoginScreen with a tactical-dark-themed version that matches the new design system. Keep all existing auth logic (`useAuth`, `signIn`, error handling, loading state) **identical**.

## Visual spec

Reference: see the Dashboard screen as your visual model — same colors, same fonts, same spacing.

Layout (top → bottom, full screen):

1. **Background:** `colors.background` with a soft radial violet glow in the top-right corner (use a positioned `<View>` with `borderRadius: 160`, `backgroundColor: colors.primary`, `opacity: 0.18`).
2. **Top brand block** (centered, 60px from top safe area):
   - Animated SVG logo (use `<Ionicons name="shield-checkmark" size={36} />` for now, wrapped in a 64×64 rounded square with a `LinearGradient` from `gradients.brand`)
   - "SHADOWFIELD" wordmark — `typography.display` size, letter-spacing 4, uppercase
   - Tagline: "Tactical Operations Platform" — `typography.bodySmall`, `colors.textSecondary`, monospace
   - Use `useFloat()` from `../animations` on the logo for subtle vertical bob.
3. **Form card** (centered vertically below brand, max-width 360):
   - `<GlassCard>` from `../components/ui`, padding 24
   - Email input: rounded 14, `colors.surfaceMute` background, `colors.border` 1px border, height 50, padding 16. Use `<Ionicons name="mail-outline">` left icon.
   - Password input: same styling. Eye toggle on right.
   - **Primary button:** `<GradientButton title="ENTER SHADOWFIELD →" onPress={handleLogin} />` from `../components/ui`. Loading state shows ActivityIndicator centered.
   - Below button: monospace caption "v4.2.1 · TLS-1.3 · SOC2" — `MonoLabel`, centered, `colors.textMute`.
4. **Animated entrance:** brand block uses `useFadeUp(0)`, form uses `useFadeUp(1, 100)`.

## Code requirements

- Keep `signIn`, `Alert`, loading state, `KeyboardAvoidingView` — all unchanged
- Replace static `colors` with `useThemeColors()` (reactive)
- Use `useMemo(() => makeStyles(colors, isDark), [colors, isDark])` pattern (see DashboardScreen for reference)
- All text colors come from `colors.*`, no hardcoded hex
- No emoji (replace 🛡️ with `<Ionicons name="shield-checkmark">`, replace 👁️/🙈 with `<Ionicons name="eye-outline">` / `<Ionicons name="eye-off-outline">`)

## Acceptance

- Login still authenticates against Supabase via `useAuth().signIn`
- Error alert still shows on failed login
- Theme toggle (if reachable from the auth gate) re-themes the screen live
- No emoji, no hardcoded colors except `#0A0A14` for button text
- Logo bobs gently, form fades up on mount

## Do NOT

- Touch `useAuth` or any context
- Add new screens or navigation routes
- Modify `theme.ts`, `animations.ts`, `components/ui/`
