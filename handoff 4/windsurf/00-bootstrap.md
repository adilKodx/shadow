# Bootstrap — wrap App.tsx with ThemeProvider

> **Run this prompt FIRST**, before any screen prompts.

You are working in the `packages/mobile` workspace of the ShadowField monorepo.

## Goal

Wrap the app root with `<ThemeProvider>` so all screens can use `useThemeColors()` and the dark/light toggle works.

## Steps

1. Open the app entry — likely `packages/mobile/App.tsx`, `packages/mobile/index.tsx`, or wherever the root component is exported.

2. Add the import at the top:
   ```tsx
   import { ThemeProvider } from './src/context/ThemeContext';
   ```

3. Wrap the entire returned JSX in `<ThemeProvider defaultMode="dark">`. It must be **outside** `<NavigationContainer>` and **outside** `<AuthProvider>` (or whatever your existing context wrappers are).

   Example shape:
   ```tsx
   return (
     <ThemeProvider defaultMode="dark">
       <SafeAreaProvider>
         <AuthProvider>
           <NavigationContainer>
             ...
           </NavigationContainer>
         </AuthProvider>
       </SafeAreaProvider>
     </ThemeProvider>
   );
   ```

4. Run `npm run ios` (or `android`). The app should launch identically to before — no visual change yet, just the provider in place.

## Acceptance

- App launches, no red error screen
- Logging in still works
- Dashboard renders (it's already converted in the foundation drop-in)
- Tapping the sun/moon icon in the Dashboard header switches theme

## Do NOT

- Modify any other files
- Touch `MapScreen.tsx`, navigation files, hooks, or services
