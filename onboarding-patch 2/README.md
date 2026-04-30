# ShadowField — Onboarding Patch

Replaces ONLY the onboarding screen with the new radar + perimeter map visuals.

## What's inside
```
src/screens/OnboardingScreen.tsx   ← the only file that changes
```

## How to apply (2 steps)

### 1. Install the SVG dependency
```bash
cd packages/mobile
npx expo install react-native-svg
```

### 2. Replace the screen file
Copy this folder's file over the existing one:

```
onboarding-patch/src/screens/OnboardingScreen.tsx
   →   packages/mobile/src/screens/OnboardingScreen.tsx
```

Overwrite when prompted.

### 3. Run
```bash
npm run ios
```

That's it. No other files touched.

## What changed
- Screen 01 — Animated radar with concentric rings, rotating sweep beam, pulse rings, hostile dots
- Screen 02 — Tactical perimeter map with dashed polygon, pulsing pins, glass info chips
- Screen 03 — Permissions cards with native toggles
- Screen 04 — Operator vs Manager role select

## Already installed (no action needed)
- expo-blur
- expo-linear-gradient
- react-native-reanimated
- react-native-safe-area-context
