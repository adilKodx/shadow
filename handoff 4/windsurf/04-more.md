# Convert MoreScreen.tsx

You are working in `packages/mobile/src/screens/MoreScreen.tsx`. Foundation files are in place.

## Goal

Restyle the More tab — profile card, sectioned menu list, sign-out, version footer. **Add a Theme toggle row** in a new "Appearance" section.

## Visual spec

1. **Header:** "MORE" title in `typography.h1`, `colors.text`.
2. **Profile card:**
   - Use `<GradientCard>` (the soft brand gradient one)
   - Avatar 56×56 with `gradients.brand` LinearGradient background, big initial centered, color `colors.textInverse` (dark mode: dark text on light gradient, so use `'#0A0A14'`)
   - Display name in `typography.h3`
   - Email in `MonoLabel`
   - Right side: `<Ionicons name="chevron-forward" color={colors.textTertiary}>`
3. **Sections** (each title is `<MonoLabel>` uppercase, then a `<GlassCard padding={0}>` containing rows):

   ### NEW: Appearance section (insert as the first section)
   ```
   APPEARANCE
   ┌─────────────────────────────────────┐
   │ 🌙 Dark mode            [toggle ON] │
   └─────────────────────────────────────┘
   ```
   - Use `<Switch>` from `react-native` for the toggle
   - `value={isDark}`, `onValueChange={toggle}` from `useTheme()`
   - `trackColor={{ false: colors.surfaceMute, true: colors.primary }}`, `thumbColor={isDark ? colors.accent : '#fff'}`
   - Icon left: `<Ionicons name="moon" color={colors.primary}>` in a 36×36 rounded square with `colors.primaryLight` background

   ### Existing sections (Operations, Resources, Account)
   Same structure as before, but each row is:
   - 36×36 rounded icon container, background = item color + '22'
   - Icon in item color
   - Label in `typography.body`, `colors.text`, flex 1
   - Chevron right in `colors.textTertiary`
   - Hairline border bottom (`colors.borderLight`) on all rows except the last
4. **Sign out button:** Full-width `<GradientButton variant="danger" title="Sign Out" />` from `../components/ui`. Wired to `handleSignOut` (existing Alert.confirm flow).
5. **Version:** `<MonoLabel>` centered, "SHADOWFIELD MOBILE · v1.0.0", `colors.textMute`.

## Code requirements

- Import `useTheme` and `useThemeColors` from `../context/ThemeContext`
- `useMemo(() => makeStyles(colors), [colors])`
- Keep `Alert.alert('Sign Out', ...)` confirm flow
- Item colors: keep the existing item.color values but use them for the icon tint and 22-alpha background

## Acceptance

- Toggling Appearance switch immediately re-themes the entire app
- Pressing Sign Out shows the existing confirm alert and calls `signOut()`
- All menu items render (most are stubs — that's fine, leave their `onPress` empty/no-op)
- No emoji except the moon `🌙` in the section header is FORBIDDEN — use `Ionicons` instead

## Do NOT

- Wire menu items to new screens (they're future work)
- Touch `useAuth`
- Add a profile edit form (out of scope)
