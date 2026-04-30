# Dashboard-Only Test Bundle

Drop these 5 files into `packages/mobile/src/`, plus one tiny edit to `App.tsx`. Test the Dashboard. If it works, we'll do the rest.

---

## Step 1 — Install one dep

```bash
cd packages/mobile
npm install expo-blur
```

That's it. Everything else (`expo-linear-gradient`, `reanimated`, `async-storage`, `vector-icons`) is already in your `package.json`.

---

## Step 2 — Drop in 5 files

All files are in this project under `handoff/src/`. Copy them to the matching paths in `packages/mobile/src/`:

| From | To | Action |
|---|---|---|
| `handoff/src/theme.ts` | `packages/mobile/src/theme.ts` | **REPLACE** existing |
| `handoff/src/animations.ts` | `packages/mobile/src/animations.ts` | NEW |
| `handoff/src/context/ThemeContext.tsx` | `packages/mobile/src/context/ThemeContext.tsx` | NEW |
| `handoff/src/components/ui/index.tsx` | `packages/mobile/src/components/ui/index.tsx` | NEW |
| `handoff/src/screens/DashboardScreen.tsx` | `packages/mobile/src/screens/DashboardScreen.tsx` | **REPLACE** existing |

> The new `theme.ts` keeps the **same exports** as your current one (`colors`, `spacing`, `radius`, `typography`, `shadow`) so your other screens (Alerts, News, More, Map, Login) keep rendering — they'll just pick up the new dark color palette automatically.

---

## Step 3 — Edit App.tsx (2 changes)

### Change 1: Add the import
After line 17 (`import { AuthProvider, useAuth } from '@shadowfield/shared/src/context/AuthContext';`), add:

```tsx
import { ThemeProvider } from './src/context/ThemeContext';
```

### Change 2: Wrap NavigationContainer

In the `App()` function at the bottom, find this block:

```tsx
<SafeAreaProvider>
  <AuthProvider>
    <NavigationContainer ...>
```

Wrap `<NavigationContainer>` with `<ThemeProvider defaultMode="dark">`:

```tsx
<SafeAreaProvider>
  <AuthProvider>
    <ThemeProvider defaultMode="dark">
      <NavigationContainer
        ref={navigationRef}
        onStateChange={(state) => {
          if (__DEV__ && state) {
            const route = state.routes[state.index ?? 0];
            console.log(`🧭 [NAV] ${route?.name}${route?.state ? ' → ' + route.state.routes[route.state.index ?? 0]?.name : ''}`);
          }
        }}
      >
        <RootNavigator />
        <StatusBar style="light" />
      </NavigationContainer>
    </ThemeProvider>
  </AuthProvider>
</SafeAreaProvider>
```

That's the entire change. **Do not modify anything else.**

---

## Step 4 — Run

```bash
npm run ios     # or npm run android
```

### What you should see

1. App launches normally (LoginScreen unchanged for now)
2. Sign in
3. Dashboard tab → **NEW DESIGN**:
   - Dark background, soft violet glow top-right
   - "GOOD MORNING · ON DUTY" caption with green pulsing dot
   - Hero card: "ZONE A · WAREHOUSE 17", `3 OPEN INCIDENTS`, mini bar chart that grows on mount
   - 6 quick-action cards in a 3-column grid
   - "Active" + "0 OPEN ALERTS" status row
4. **Tap the sun/moon icon** in the top-right → Dashboard re-themes to light mode instantly. Tap again → back to dark. Choice persists across app restarts.
5. Other tabs (News/Alerts/More/Map) render in their existing style — that's expected. We restyle them next.

### If something breaks

| Symptom | Fix |
|---|---|
| Red error: "Cannot find module 'expo-blur'" | You skipped step 1. `npm install expo-blur` |
| Red error about `useTheme must be used within ThemeProvider` | Step 3 was wrong — `ThemeProvider` must wrap `NavigationContainer` |
| TypeScript errors in other screens | Old screens still import from `theme` — they should still compile. Tell me what error you see. |
| Dashboard renders but theme toggle does nothing | Hot reload didn't pick up new files — fully reload (Cmd+R in iOS sim) |

---

## After it works

Tell me **"dashboard works"** and I'll do the same drop-in for:

1. **LoginScreen** — biggest sales-impact (first impression)
2. **Tab bar** — the floating glass navigation visible everywhere
3. **AlertsScreen** — pulsing critical alerts, severity chips

…each as its own small PR you can verify before moving on.

If something's off, screenshot the simulator and tell me — I'll fix it before we touch any other screen.
