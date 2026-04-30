// LoginScreen.tsx — REPLACES existing
// Preserves: useAuth, signIn, Alert error flow, KeyboardAvoidingView
// Visual: dark tactical, gradient logo, glass form card, gradient CTA

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated from 'react-native-reanimated';
import { useAuth } from '@shadowfield/shared/src/context/AuthContext';
import { spacing, radius, typography, gradients, type ThemeColors } from '../theme';
import { useThemeColors, useIsDark } from '../context/ThemeContext';
import { useFadeUp, useFloat } from '../animations';
import { GlassCard, GradientButton, MonoLabel } from '../components/ui';
import { BRAND } from '../brand';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const colors = useThemeColors();
  const isDark = useIsDark();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const brandFade = useFadeUp(0);
  const formFade = useFadeUp(1, 100);
  const float = useFloat(4);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }
    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    setLoading(false);
    if (error) {
      Alert.alert('Login Failed', error.message || 'Invalid credentials');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Ambient glow (dark only) */}
      {isDark && (
        <>
          <View style={[styles.glow, { top: -120, right: -120, backgroundColor: colors.primary }]} />
          <View style={[styles.glow, { bottom: -120, left: -120, backgroundColor: colors.accent, opacity: 0.12 }]} />
        </>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Brand block */}
        <Animated.View style={[styles.brand, brandFade]}>
          <Animated.View style={float}>
            <LinearGradient colors={gradients.brand as any} style={styles.logo}>
              <Ionicons name="shield-checkmark" size={32} color="#0A0A14" />
            </LinearGradient>
          </Animated.View>
          <Text style={styles.title}>{BRAND.appNameUpper}</Text>
          <MonoLabel style={{ marginTop: 4 }}>{BRAND.loginTagline}</MonoLabel>
        </Animated.View>

        {/* Form card */}
        <Animated.View style={formFade}>
          <GlassCard padding={spacing.xxl}>
            <MonoLabel style={{ marginBottom: 20 }}>SECURE ACCESS</MonoLabel>

            {/* Email */}
            <View style={styles.field}>
              <Ionicons name="mail-outline" size={18} color={colors.textTertiary} style={styles.fieldIcon} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder={BRAND.loginEmailPlaceholder}
                placeholderTextColor={colors.textMute}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
            </View>

            {/* Password */}
            <View style={[styles.field, { marginTop: 12 }]}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.textTertiary} style={styles.fieldIcon} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.textMute}
                secureTextEntry={!showPassword}
                editable={!loading}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eye}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={colors.textTertiary}
                />
              </TouchableOpacity>
            </View>

            <View style={{ height: 20 }} />

            {loading ? (
              <View style={styles.loadingBtn}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : (
              <GradientButton title={BRAND.loginButtonLabel} onPress={handleLogin} />
            )}
          </GlassCard>

          <MonoLabel style={{ textAlign: 'center', marginTop: 20 }}>
            v1.0.0 · TLS-1.3 · SOC2
          </MonoLabel>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  glow: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    opacity: 0.18,
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  brand: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    ...typography.display,
    color: colors.text,
    letterSpacing: 4,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMute,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    height: 50,
    paddingHorizontal: 14,
  },
  fieldIcon: { marginRight: 10 },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 0,
  },
  eye: { padding: 6 },
  loadingBtn: {
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMute,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
