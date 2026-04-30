import './src/utils/devLogger';
import 'react-native-url-polyfill/auto';
// Importing for side-effect: registers the background-location TaskManager task
// at module load so it can be triggered even when the app cold-starts.
import './src/services/backgroundLocation';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import React, { useCallback, useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, ScrollView } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import only what we need — avoid barrel import that eagerly loads all hooks
import { initSupabase } from '@shadowfield/shared/src/lib/supabase';
import { AuthProvider, useAuth } from '@shadowfield/shared/src/context/AuthContext';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './src/config';

import LoginScreen from './src/screens/LoginScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import DrawerNav from './src/navigation/DrawerNav';
import { usePushNotifications } from './src/hooks/usePushNotifications';
import { ThemeProvider } from './src/context/ThemeContext';

// Initialize Supabase with React Native-specific options
try {
  initSupabase(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  console.log('[App] Supabase initialized');
} catch (e) {
  console.error('[App] Failed to initialize Supabase:', e);
}

export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Main: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Top-level navigation ref so push-notification taps can navigate without
// being inside the React tree.
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <View style={styles.loadingLogo}>
        <Text style={styles.loadingIcon}>🛡️</Text>
      </View>
      <Text style={styles.loadingTitle}>ShadowField</Text>
      <Text style={styles.loadingSubtitle}>Security & Communication Platform</Text>
      <ActivityIndicator size="large" color="#60a5fa" style={{ marginTop: 32 }} />
    </View>
  );
}

// Error boundary to catch and display crashes
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: any) {
    console.error('[ErrorBoundary]', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>App Error</Text>
          <ScrollView style={styles.errorScroll}>
            <Text style={styles.errorText}>
              {this.state.error?.message || 'Unknown error'}
            </Text>
            <Text style={styles.errorStack}>
              {this.state.error?.stack?.slice(0, 500)}
            </Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

function RootNavigator() {
  const { user, tenant, loading } = useAuth();
  const [seenOnboarding, setSeenOnboarding] = React.useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('shadowfield.onboarding.done').then(v =>
      setSeenOnboarding(v === '1'),
    );
  }, []);

  // Deep-link handler — when a push notification is tapped that contains
  // an `incident_id`, jump to LiveMap focused on it.
  //
  // On iOS cold-start the listener fires BEFORE NavigationContainer is ready
  // and BEFORE auth resolves the user/tenant. We queue the tap data and drain
  // it as soon as both prerequisites are satisfied.
  const pendingTapRef = useRef<Record<string, any> | null>(null);

  const performNavigate = useCallback((data: Record<string, any>) => {
    const incidentId = data?.incident_id || data?.incidentId;
    if (incidentId) {
      // Nonce forces the params object to change even when the user taps a
      // notification for the SAME incident twice, or when LiveMap is already
      // focused (in which case React Navigation merges params and the dep
      // array on focusIncidentId alone would not re-run the deep-link effect).
      const focusNonce = Date.now();
      console.log('[App] push tap → LiveMap incident', incidentId, 'nonce', focusNonce);
      navigationRef.navigate('Main' as any, {
        screen: 'LiveMap',
        params: { focusIncidentId: incidentId, focusNonce },
      });
    } else if (data?.screen === 'LiveMap') {
      navigationRef.navigate('Main' as any, { screen: 'LiveMap' });
    }
  }, []);

  const handlePushTap = useCallback(
    (data: Record<string, any>) => {
      // Queue if navigation tree isn't mounted OR auth hasn't loaded the
      // session yet. The drain effect below will replay it.
      if (!navigationRef.isReady() || !user || !tenant) {
        console.log('[App] push tap queued (navReady/auth not ready)', {
          navReady: navigationRef.isReady(),
          hasUser: !!user,
          hasTenant: !!tenant,
        });
        pendingTapRef.current = data;
        return;
      }
      performNavigate(data);
    },
    [user, tenant, performNavigate],
  );

  // Drain the queue once nav + auth are both ready.
  // We poll briefly because navigationRef.isReady() is a function call, not
  // reactive state — useEffect alone won't fire when nav transitions to ready.
  useEffect(() => {
    if (!user || !tenant) return;
    if (!pendingTapRef.current) return;
    let attempts = 0;
    const tryDrain = () => {
      if (!pendingTapRef.current) return;
      if (!navigationRef.isReady()) {
        if (attempts++ > 40) return; // give up after ~4s
        setTimeout(tryDrain, 100);
        return;
      }
      const pending = pendingTapRef.current;
      pendingTapRef.current = null;
      console.log('[App] draining queued push tap');
      performNavigate(pending);
    };
    tryDrain();
  }, [user, tenant, performNavigate]);

  // Register device token + listen for notification taps once authenticated
  usePushNotifications(handlePushTap);

  if (loading || seenOnboarding === null) {
    return <LoadingScreen />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      {!seenOnboarding ? (
        <Stack.Screen name="Onboarding">
          {(props) => (
            <OnboardingScreen
              {...props}
              onDone={() => {
                AsyncStorage.setItem('shadowfield.onboarding.done', '1');
                setSeenOnboarding(true);
              }}
            />
          )}
        </Stack.Screen>
      ) : user && tenant ? (
        <Stack.Screen name="Main" component={DrawerNav} />
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
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
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingLogo: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  loadingIcon: {
    fontSize: 40,
  },
  loadingTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  loadingSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#7f1d1d',
    padding: 24,
    paddingTop: 60,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fca5a5',
    marginBottom: 12,
  },
  errorScroll: {
    flex: 1,
  },
  errorText: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 8,
  },
  errorStack: {
    fontSize: 11,
    color: '#fca5a5',
    fontFamily: 'monospace',
  },
});
