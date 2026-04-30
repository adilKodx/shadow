# 00 — Setup (run this first)

You are integrating a visual refresh into the existing Expo app at
`packages/mobile/`. The handoff bundle lives at `handoff/` in the repo root
(or wherever the user pasted it).

## Tasks

### 1. Install missing dependencies

```bash
cd packages/mobile
npm install expo-blur
```

`expo-linear-gradient`, `react-native-reanimated`, `@react-native-async-storage/async-storage`,
and `@expo/vector-icons` are already in package.json — no change needed.

Confirm `babel.config.js` includes the Reanimated plugin (it must be the LAST plugin):

```js
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'], // must be last
  };
};
```

### 2. Copy foundation files

Copy these from `handoff/src/` to `packages/mobile/src/`:

| From | To | Action |
|---|---|---|
| `handoff/src/theme.ts` | `packages/mobile/src/theme.ts` | **REPLACE** existing |
| `handoff/src/animations.ts` | `packages/mobile/src/animations.ts` | NEW |
| `handoff/src/context/ThemeContext.tsx` | `packages/mobile/src/context/ThemeContext.tsx` | NEW (create folder) |
| `handoff/src/components/ui/index.tsx` | `packages/mobile/src/components/ui/index.tsx` | NEW (create folder) |

### 3. Wrap app in `<ThemeProvider>`

Find the app root (likely `App.tsx`, `index.js`, or wherever `NavigationContainer`
is mounted). Wrap the existing tree:

```tsx
import { ThemeProvider } from './src/context/ThemeContext';

// Before:
<NavigationContainer>...</NavigationContainer>

// After:
<ThemeProvider defaultMode="dark">
  <NavigationContainer>...</NavigationContainer>
</ThemeProvider>
```

If `<AuthProvider>` or other providers exist, `<ThemeProvider>` should sit
**outside** them (closest to root) so theme works on the login screen too.

### 4. Replace DashboardScreen as reference

Copy `handoff/src/screens/DashboardScreen.tsx` over
`packages/mobile/src/screens/DashboardScreen.tsx`.

Read it. It's the canonical pattern every other screen will follow:
- `useThemeColors()` instead of static `colors`
- `makeStyles(colors, isDark)` factory function called via `useMemo`
- `<GlassCard>` / `<GradientCard>` / `<SevChip>` / `<GlowDot>` / `<MonoLabel>` from `components/ui`
- Animated entrances via `useFadeUp(index)`
- Hero card uses `<GradientCard>` with shimmer overlay

### 5. Verify it runs

```bash
cd packages/mobile
npx expo start
```

Open on a device/simulator. You should see:
- Dark tactical Dashboard (violet glow top-right, mono-style timestamps)
- Sun/moon icon in the header — tap it to flip to light mode
- Choice persists across app restarts

Other screens still use the old visual language — that's expected. They get
converted one prompt at a time after this.

## Done when

- App launches without errors
- Theme toggle in Dashboard header works
- All other screens still render (just with old styling)
