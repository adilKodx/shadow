# Drawer Patch — ShadowField Side Navigation

Replaces the stock drawer with the new tactical UI.

## Apply (3 steps)

### 1. Copy file
```
drawer-patch/CustomDrawerContent.tsx → packages/mobile/src/navigation/CustomDrawerContent.tsx
```

### 2. Wire it in DrawerNav.tsx
At the top of `packages/mobile/src/navigation/DrawerNav.tsx`:
```tsx
import CustomDrawerContent from './CustomDrawerContent';
```

On `<Drawer.Navigator>` add:
```tsx
drawerContent={(props) => <CustomDrawerContent {...props} />}
screenOptions={{
  headerShown: false,
  drawerStyle: { backgroundColor: 'transparent', width: 300 },
  drawerType: 'front',
  overlayColor: 'rgba(0,0,0,0.6)',
}}
```

### 3. Run
```
cd packages/mobile && npm run ios
```

## Required deps (already installed)
- react-native-svg
- expo-linear-gradient
- @expo/vector-icons
- react-native-safe-area-context
