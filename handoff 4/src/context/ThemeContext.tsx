// ShadowField — ThemeContext
// Persists "dark" | "light" preference in AsyncStorage and exposes:
//   useThemeMode()    → ['dark' | 'light', setMode]
//   useThemeColors()  → currently active palette (reactive)
//   useIsDark()       → boolean shortcut
//
// Wrap your <App /> root with <ThemeProvider> ABOVE the navigation container.

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import { darkColors, lightColors, type ThemeColors, type ThemeMode } from '../theme';

const STORAGE_KEY = '@shadowfield/theme-mode';

type Ctx = {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  toggle: () => void;
  colors: ThemeColors;
  isDark: boolean;
  ready: boolean;
};

const ThemeContext = createContext<Ctx | null>(null);

export function ThemeProvider({ children, defaultMode = 'dark' }: { children: React.ReactNode; defaultMode?: ThemeMode }) {
  const [mode, setModeState] = useState<ThemeMode>(defaultMode);
  const [ready, setReady] = useState(false);

  // Hydrate from storage; fall back to system color scheme, then defaultMode
  useEffect(() => {
    (async () => {
      try {
        const stored = (await AsyncStorage.getItem(STORAGE_KEY)) as ThemeMode | null;
        if (stored === 'dark' || stored === 'light') {
          setModeState(stored);
        } else {
          const sys = Appearance.getColorScheme();
          if (sys === 'dark' || sys === 'light') setModeState(sys);
        }
      } catch {}
      setReady(true);
    })();
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem(STORAGE_KEY, m).catch(() => {});
  }, []);

  const toggle = useCallback(() => {
    setMode(mode === 'dark' ? 'light' : 'dark');
  }, [mode, setMode]);

  const colors = (mode === 'light' ? lightColors : darkColors) as ThemeColors;

  return (
    <ThemeContext.Provider value={{ mode, setMode, toggle, colors, isDark: mode === 'dark', ready }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): Ctx {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

export function useThemeColors(): ThemeColors {
  return useTheme().colors;
}

export function useThemeMode(): [ThemeMode, (m: ThemeMode) => void] {
  const { mode, setMode } = useTheme();
  return [mode, setMode];
}

export function useIsDark(): boolean {
  return useTheme().isDark;
}
