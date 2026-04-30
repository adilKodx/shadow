import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@shadowfield/shared/src/context/AuthContext';
import { colors, spacing, radius, typography } from '../theme';
import MainTabs from './MainTabs';
import MapScreen from '../screens/MapScreen';
import NotificationSettingsScreen from '../screens/NotificationSettingsScreen';
import SetupGuideScreen from '../screens/SetupGuideScreen';
import ChatScreen from '../screens/ChatScreen';
import NotificationsScreen from '../screens/NotificationsScreen';

const Drawer = createDrawerNavigator();

function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { user, tenant, member, signOut } = useAuth();

  const menuItems = [
    { icon: 'grid-outline', label: 'Dashboard', screen: 'MainTabs' },
    { icon: 'chatbubbles-outline', label: 'Chat', screen: 'Chat' },
    { icon: 'notifications-outline', label: 'Notifications', screen: 'Notifications' },
    { icon: 'newspaper-outline', label: 'News', screen: null },
    { icon: 'warning-outline', label: 'Alerts', screen: null },
    { icon: 'document-text-outline', label: 'Incidents', screen: null },
    { icon: 'clipboard-outline', label: 'SOPs', screen: null },
    { icon: 'map-outline', label: 'Live Map', screen: 'LiveMap' },
    { icon: 'person-outline', label: 'POI Database', screen: null },
    { icon: 'people-outline', label: 'Team', screen: null },
    { icon: 'calendar-outline', label: 'Attendance', screen: null },
    { icon: 'videocam-outline', label: 'Video Feeds', screen: null },
    { icon: 'settings-outline', label: 'Notification Settings', screen: 'NotificationSettings' },
    { icon: 'help-buoy-outline', label: 'Setup Guide', screen: 'SetupGuide' },
  ];

  // Layout: scrollable header+menu inside DrawerContentScrollView, with a
  // sticky footer rendered as a sibling below it. This is more robust than
  // the previous flex/marginTop:auto approach which on tall menus could leave
  // the footer below the viewport and (on some Android builds) confuse the
  // gesture handler so the menu items wouldn't register taps.
  return (
    <View style={styles.drawerRoot}>
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={styles.drawerContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.drawerHeader}>
          <View style={styles.drawerAvatar}>
            <Text style={styles.drawerAvatarText}>
              {(member?.display_name || user?.email || 'U')[0].toUpperCase()}
            </Text>
          </View>
          <Text style={styles.drawerName}>{member?.display_name || 'User'}</Text>
          <Text style={styles.drawerOrg}>{tenant?.name || 'Organization'}</Text>
          <View style={styles.drawerRoleBadge}>
            <Text style={styles.drawerRole}>{member?.role || 'member'}</Text>
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.menuContainer}>
          {menuItems.map(item => (
            <TouchableOpacity
              key={item.label}
              style={styles.menuItem}
              activeOpacity={0.6}
              onPress={() => {
                if (item.screen) {
                  props.navigation.navigate(item.screen);
                }
                props.navigation.closeDrawer();
              }}
            >
              <Ionicons name={item.icon as any} size={20} color={colors.textSecondary} />
              <Text style={styles.menuLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </DrawerContentScrollView>

      {/* Sticky footer — outside the ScrollView so it's always visible and
          its tap target never drifts off-screen on tall menus. */}
      <View style={styles.drawerFooter}>
        <TouchableOpacity style={styles.signOutItem} onPress={signOut} activeOpacity={0.6}>
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={styles.signOutLabel}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function DrawerNav() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'front',
        drawerStyle: styles.drawer,
        overlayColor: 'rgba(0,0,0,0.5)',
      }}
    >
      <Drawer.Screen name="MainTabs" component={MainTabs} />
      <Drawer.Screen name="LiveMap" component={MapScreen} />
      <Drawer.Screen name="Chat" component={ChatScreen} />
      <Drawer.Screen name="Notifications" component={NotificationsScreen} />
      <Drawer.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
      <Drawer.Screen name="SetupGuide" component={SetupGuideScreen} />
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  drawer: {
    width: 280,
    backgroundColor: colors.surface,
  },
  drawerRoot: {
    flex: 1,
  },
  drawerContent: {
    // ScrollView content. We deliberately do NOT set `flex: 1` here — that
    // would clamp the content to viewport height and prevent scrolling when
    // the menu is taller than the screen. `paddingBottom` reserves space so
    // the last menu item isn't covered by the sticky footer.
    paddingBottom: spacing.md,
  },
  drawerHeader: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    backgroundColor: colors.headerBg,
    alignItems: 'center',
  },
  drawerAvatar: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  drawerAvatarText: {
    ...typography.h2,
    color: colors.textInverse,
  },
  drawerName: {
    ...typography.h3,
    color: colors.textInverse,
    marginBottom: spacing.xs,
  },
  drawerOrg: {
    ...typography.bodySmall,
    color: colors.tabInactive,
    marginBottom: spacing.sm,
  },
  drawerRoleBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  drawerRole: {
    ...typography.caption,
    color: colors.textInverse,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  menuContainer: {
    paddingTop: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  menuLabel: {
    ...typography.body,
    color: colors.text,
  },
  drawerFooter: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  signOutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  signOutLabel: {
    ...typography.label,
    color: colors.error,
  },
});
