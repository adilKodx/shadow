import React, { useState, useCallback, memo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAlerts, type Alert } from '@shadowfield/shared/src/hooks/useAlerts';
import { useAuth } from '@shadowfield/shared/src/context/AuthContext';
import { colors, spacing, radius, typography, shadow } from '../theme';

const SEVERITY_STYLES: Record<string, { icon: string; color: string; bg: string }> = {
  critical: { icon: 'alert-circle', color: '#dc2626', bg: '#fee2e2' },
  high: { icon: 'warning', color: '#ea580c', bg: '#fff7ed' },
  medium: { icon: 'information-circle', color: '#d97706', bg: '#fef3c7' },
  low: { icon: 'chevron-down-circle', color: '#2563eb', bg: '#dbeafe' },
};

// Runtime DB rows include `severity` and `status` fields that the shared
// `Alert` interface does not yet declare. Extend locally to keep type-safety
// without touching the shared package.
type AlertRow = Alert & {
  severity: 'critical' | 'high' | 'medium' | 'low' | string;
  status: 'active' | 'acknowledged' | string;
};

type AlertCardProps = {
  alert: AlertRow;
  onAcknowledge: (id: string) => void;
};

const AlertCard = memo(function AlertCard({ alert, onAcknowledge }: AlertCardProps) {
  const sev = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.medium;
  return (
    <View style={[styles.alertCard, shadow.sm]}>
      <View style={[styles.severityIcon, { backgroundColor: sev.bg }]}>
        <Ionicons name={sev.icon as any} size={20} color={sev.color} />
      </View>
      <View style={styles.alertBody}>
        <View style={styles.alertTop}>
          <Text style={styles.alertTitle} numberOfLines={1}>{alert.title}</Text>
          <Text style={styles.alertTime}>
            {new Date(alert.created_at).toLocaleDateString()}
          </Text>
        </View>
        <Text style={styles.alertMessage} numberOfLines={2}>{alert.message}</Text>
        <View style={styles.alertFooter}>
          <View style={[styles.statusPill, alert.status === 'active' ? styles.statusActive : styles.statusAck]}>
            <Text style={[styles.statusText, alert.status === 'active' ? styles.statusTextActive : styles.statusTextAck]}>
              {alert.status}
            </Text>
          </View>
          {alert.status === 'active' && (
            <TouchableOpacity
              style={styles.ackButton}
              onPress={() => onAcknowledge(alert.id)}
            >
              <Text style={styles.ackButtonText}>Acknowledge</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
});

export default function AlertsScreen() {
  const { alerts, loading, fetchAlerts, acknowledgeAlert } = useAlerts();
  const { member } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'acknowledged'>('all');

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAlerts();
    setRefreshing(false);
  }, [fetchAlerts]);

  const filtered = alerts.filter(a => {
    if (filter === 'active') return a.status === 'active';
    if (filter === 'acknowledged') return a.status === 'acknowledged';
    return true;
  });

  const handleAcknowledge = useCallback(
    (id: string) => {
      acknowledgeAlert(id);
    },
    [acknowledgeAlert],
  );

  const renderItem = useCallback(
    ({ item }: { item: Alert }) => (
      <AlertCard alert={item as AlertRow} onAcknowledge={handleAcknowledge} />
    ),
    [handleAcknowledge],
  );

  const keyExtractor = useCallback((item: Alert) => item.id, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Alerts</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{alerts.filter(a => a.status === 'active').length}</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabRow}>
        {(['all', 'active', 'acknowledged'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, filter === tab && styles.tabActive]}
            onPress={() => setFilter(tab)}
          >
            <Text style={[styles.tabText, filter === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && alerts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          windowSize={9}
          updateCellsBatchingPeriod={50}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="checkmark-circle-outline" size={48} color={colors.textTertiary} />
              <Text style={styles.emptyTitle}>No alerts</Text>
              <Text style={styles.emptySubtitle}>All clear!</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  headerTitle: { ...typography.h2, color: colors.text },
  badge: {
    backgroundColor: colors.error,
    borderRadius: radius.full,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { ...typography.caption, color: colors.textInverse, fontSize: 11 },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  tab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.headerBg, borderColor: colors.headerBg },
  tabText: { ...typography.caption, color: colors.textSecondary },
  tabTextActive: { color: colors.textInverse },
  listContent: { padding: spacing.xl, paddingBottom: 100, gap: spacing.md },
  alertCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    gap: spacing.md,
  },
  severityIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertBody: { flex: 1 },
  alertTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  alertTitle: { ...typography.label, color: colors.text, flex: 1 },
  alertTime: { ...typography.caption, color: colors.textTertiary },
  alertMessage: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: spacing.sm },
  alertFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusPill: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },
  statusActive: { backgroundColor: '#fee2e2' },
  statusAck: { backgroundColor: '#dcfce7' },
  statusText: { ...typography.caption, fontSize: 10, textTransform: 'uppercase' },
  statusTextActive: { color: '#dc2626' },
  statusTextAck: { color: '#16a34a' },
  ackButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.sm,
  },
  ackButtonText: { ...typography.caption, color: colors.primary },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyTitle: { ...typography.h3, color: colors.textSecondary, marginTop: spacing.md },
  emptySubtitle: { ...typography.bodySmall, color: colors.textTertiary, marginTop: spacing.xs },
});
