# ShadowField — Complete Drop-In Bundle

All screens converted to the new tactical design system. Drop into `packages/mobile/`.

## Step 1 — Install
```bash
cd packages/mobile
npm install expo-blur
```

## Step 2 — Copy files

| From | To |
|---|---|
| `handoff/src/theme.ts` | `packages/mobile/src/theme.ts` (REPLACE) |
| `handoff/src/animations.ts` | `packages/mobile/src/animations.ts` (NEW) |
| `handoff/src/context/ThemeContext.tsx` | `packages/mobile/src/context/ThemeContext.tsx` (NEW) |
| `handoff/src/components/ui/index.tsx` | `packages/mobile/src/components/ui/index.tsx` (NEW) |
| `handoff/src/screens/DashboardScreen.tsx` | `packages/mobile/src/screens/DashboardScreen.tsx` (REPLACE) |
| `handoff/src/screens/LoginScreen.tsx` | `packages/mobile/src/screens/LoginScreen.tsx` (REPLACE) |
| `handoff/src/screens/OnboardingScreen.tsx` | `packages/mobile/src/screens/OnboardingScreen.tsx` (NEW) |
| `handoff/src/screens/ChatScreen.tsx` | `packages/mobile/src/screens/ChatScreen.tsx` (NEW) |
| `handoff/src/screens/NotificationsScreen.tsx` | `packages/mobile/src/screens/NotificationsScreen.tsx` (NEW) |

## Step 3 — Edit `packages/mobile/App.tsx`

**Add imports:**
```tsx
import { ThemeProvider } from './src/context/ThemeContext';
import OnboardingScreen from './src/screens/OnboardingScreen';
```

**Wrap NavigationContainer with `<ThemeProvider defaultMode="dark">`:**
```tsx
<SafeAreaProvider>
  <AuthProvider>
    <ThemeProvider defaultMode="dark">
      <NavigationContainer ...>
        <RootNavigator />
        <StatusBar style="light" />
      </NavigationContainer>
    </ThemeProvider>
  </AuthProvider>
</SafeAreaProvider>
```

**(Optional) Add onboarding gate** to `RootNavigator`:
```tsx
const [seenOnboarding, setSeenOnboarding] = useState<boolean | null>(null);
useEffect(() => {
  AsyncStorage.getItem('shadowfield.onboarding.done').then(v => setSeenOnboarding(v === '1'));
}, []);
if (loading || seenOnboarding === null) return <LoadingScreen />;

return (
  <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
    {!seenOnboarding ? (
      <Stack.Screen name="Onboarding">
        {(p) => <OnboardingScreen {...p} onDone={() => {
          AsyncStorage.setItem('shadowfield.onboarding.done', '1');
          setSeenOnboarding(true);
        }} />}
      </Stack.Screen>
    ) : user && tenant ? (
      <Stack.Screen name="Main" component={DrawerNav} />
    ) : (
      <Stack.Screen name="Login" component={LoginScreen} />
    )}
  </Stack.Navigator>
);
```

## Step 4 — Wire Chat + Notifications into navigation

In `packages/mobile/src/navigation/DrawerNav.tsx` (or your tab navigator), add:
```tsx
import ChatScreen from '../screens/ChatScreen';
import NotificationsScreen from '../screens/NotificationsScreen';

// As drawer screens or tab screens:
<Drawer.Screen name="Chat" component={ChatScreen} />
<Drawer.Screen name="Notifications" component={NotificationsScreen} />
```

## Step 5 — Run
```bash
npm run ios   # or android
```

## What you get

- **Onboarding** — 4-step animated intro (shield/map/bell/chat), pulsing rings, gradient CTAs, skip + back nav
- **Login** — Tactical dark, gradient logo, glass form, animated entrance
- **Dashboard** — Hero status card, mini bar chart, quick actions, theme toggle
- **Chat** — Thread list with online dots + unread badges, detail view with bubbles, typing indicator, gradient send button
- **Notifications** — Filter pills (All/Unread/Critical/Messages), pulsing rings on critical unread, severity chips, mark-all-read
- **Theme toggle** — Sun/moon in dashboard header, persists across restarts

## Untouched (still works)
- MapScreen
- AlertsScreen, NewsScreen, MoreScreen, NotificationSettingsScreen, SetupGuideScreen, HomeScreen
- All `useAuth`, `useAlerts`, `useNews`, push notification logic
- Mapbox, Supabase, navigation structure

These continue rendering in their original style. Restyle them later using the same pattern as DashboardScreen (use `useThemeColors()`, `makeStyles(colors)`, components from `'../components/ui'`).
