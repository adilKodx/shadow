import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@shadowfield/shared/src/context/AuthContext';
import { colors, spacing, radius, typography, shadow } from '../theme';

const QUICK_ACTIONS = [
  { icon: 'chatbubbles', label: 'Chat', color: '#3b82f6', bg: '#dbeafe' },
  { icon: 'warning', label: 'Alerts', color: '#ef4444', bg: '#fee2e2' },
  { icon: 'document-text', label: 'Incidents', color: '#8b5cf6', bg: '#ede9fe' },
  { icon: 'map', label: 'Map', color: '#10b981', bg: '#d1fae5' },
  { icon: 'newspaper', label: 'News', color: '#f59e0b', bg: '#fef3c7' },
  { icon: 'people', label: 'Team', color: '#6366f1', bg: '#e0e7ff' },
] as const;

export default function DashboardScreen({ navigation }: any) {
  const { user, tenant, member } = useAuth();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise(r => setTimeout(r, 1000));
    setRefreshing(false);
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => navigation.openDrawer()}
            style={styles.hamburger}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="menu" size={24} color={colors.textInverse} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerGreeting}>{greeting()}</Text>
            <Text style={styles.headerName}>{member?.display_name || user?.email?.split('@')[0]}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.avatarButton}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(member?.display_name || user?.email || 'U')[0].toUpperCase()}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Org Card */}
        <View style={[styles.orgCard, shadow.md]}>
          <View style={styles.orgBadge}>
            <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
          </View>
          <Text style={styles.orgName}>{tenant?.name || 'Organization'}</Text>
          <Text style={styles.orgRole}>{member?.role || 'member'}</Text>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {QUICK_ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.label}
              style={[styles.actionCard, shadow.sm]}
              activeOpacity={0.7}
              onPress={() => {
                if (action.label === 'News') navigation.navigate('MainTabs', { screen: 'News' });
              }}
            >
              <View style={[styles.actionIcon, { backgroundColor: action.bg }]}>
                <Ionicons name={action.icon as any} size={22} color={action.color} />
              </View>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Status Cards */}
        <Text style={styles.sectionTitle}>Status</Text>
        <View style={styles.statusRow}>
          <View style={[styles.statusCard, shadow.sm, { borderLeftColor: colors.success }]}>
            <Text style={styles.statusValue}>Active</Text>
            <Text style={styles.statusLabel}>System Status</Text>
          </View>
          <View style={[styles.statusCard, shadow.sm, { borderLeftColor: colors.info }]}>
            <Text style={styles.statusValue}>0</Text>
            <Text style={styles.statusLabel}>Open Alerts</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.headerBg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.headerBg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  hamburger: {
    padding: spacing.xs,
  },
  headerGreeting: {
    ...typography.caption,
    color: colors.tabInactive,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headerName: {
    ...typography.h3,
    color: colors.textInverse,
  },
  avatarButton: {
    padding: 2,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    ...typography.label,
    color: colors.textInverse,
    fontSize: 16,
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  scrollContent: {
    padding: spacing.xl,
    paddingBottom: 100,
  },
  orgCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  orgBadge: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  orgName: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  orgRole: {
    ...typography.caption,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  sectionTitle: {
    ...typography.label,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.md,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  actionCard: {
    width: '30.5%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  actionLabel: {
    ...typography.caption,
    color: colors.text,
  },
  statusRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statusCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderLeftWidth: 3,
  },
  statusValue: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  statusLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
