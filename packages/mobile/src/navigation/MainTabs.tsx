import React from 'react';
import { StyleSheet, Platform, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';

import DashboardScreen from '../screens/DashboardScreen';
import NewsScreen from '../screens/NewsScreen';
import AlertsScreen from '../screens/AlertsScreen';
import MoreScreen from '../screens/MoreScreen';

export type MainTabParamList = {
  Dashboard: undefined;
  News: undefined;
  Alerts: undefined;
  More: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;
          switch (route.name) {
            case 'Dashboard':
              iconName = focused ? 'grid' : 'grid-outline';
              break;
            case 'News':
              iconName = focused ? 'newspaper' : 'newspaper-outline';
              break;
            case 'Alerts':
              iconName = focused ? 'warning' : 'warning-outline';
              break;
            case 'More':
              iconName = focused ? 'ellipsis-horizontal-circle' : 'ellipsis-horizontal-circle-outline';
              break;
            default:
              iconName = 'ellipse';
          }
          return (
            <View style={focused ? styles.activeIconWrap : undefined}>
              <Ionicons name={iconName} size={focused ? 22 : 24} color={color} />
            </View>
          );
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
        lazy: true,
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="News" component={NewsScreen} />
      <Tab.Screen name="Alerts" component={AlertsScreen} />
      <Tab.Screen name="More" component={MoreScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 20 : 12,
    left: 16,
    right: 16,
    height: 64,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderTopWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
    paddingBottom: 0,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: -2,
    marginBottom: Platform.OS === 'ios' ? 0 : 8,
  },
  tabItem: {
    paddingTop: 8,
  },
  activeIconWrap: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.sm,
    padding: 6,
    marginTop: -2,
  },
});
