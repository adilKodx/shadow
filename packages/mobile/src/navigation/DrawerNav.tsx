import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import CustomDrawerContent from './CustomDrawerContent';
import MainTabs from './MainTabs';
import MapScreen from '../screens/MapScreen';
import NotificationSettingsScreen from '../screens/NotificationSettingsScreen';
import SetupGuideScreen from '../screens/SetupGuideScreen';
import ChatScreen from '../screens/ChatScreen';
import NotificationsScreen from '../screens/NotificationsScreen';

const Drawer = createDrawerNavigator();

export default function DrawerNav() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerStyle: { backgroundColor: 'transparent', width: 300 },
        drawerType: 'front',
        overlayColor: 'rgba(0,0,0,0.6)',
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
