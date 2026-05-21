import React from 'react';
import {Platform} from 'react-native';
import {createMaterialTopTabNavigator} from '@react-navigation/material-top-tabs';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {useTheme} from '../theme';

import DashboardScreen from '../screens/DashboardScreen';
import CertificatesScreen from '../screens/CertificatesScreen';
import UploadCertificateScreen from '../screens/UploadCertificateScreen';

import {useFcmToken} from '../utils/useFcmToken';

const Tab = createMaterialTopTabNavigator();

export default function StudentTabNavigator() {
  const {colors} = useTheme();
  const insets = useSafeAreaInsets();

  useFcmToken();

  return (
    <Tab.Navigator
      tabBarPosition="bottom"
      screenOptions={{
        swipeEnabled: true,
        animationEnabled: true,
        lazy: true,

        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,

        tabBarShowIcon: true,

        tabBarIndicatorStyle: {
          backgroundColor: colors.primary,
          height: 3,
          borderRadius: 10,
        },

        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,

          elevation: 8,

          height: Platform.OS === 'android'
            ? 65 + insets.bottom
            : 80,

          paddingBottom: insets.bottom,
        },

        tabBarItemStyle: {
          paddingVertical: 4,
        },

        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          textTransform: 'none',
        },

        tabBarPressColor: 'transparent',
      }}>

      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({color}) => (
            <MaterialCommunityIcons
              name="view-dashboard-outline"
              color={color}
              size={24}
            />
          ),
        }}
      />

      <Tab.Screen
        name="Certificates"
        component={CertificatesScreen}
        options={{
          tabBarLabel: 'Certificates',
          tabBarIcon: ({color}) => (
            <MaterialCommunityIcons
              name="certificate-outline"
              color={color}
              size={24}
            />
          ),
        }}
      />

      <Tab.Screen
        name="Upload"
        component={UploadCertificateScreen}
        options={{
          tabBarLabel: 'Upload',
          tabBarIcon: ({color}) => (
            <MaterialCommunityIcons
              name="upload-outline"
              color={color}
              size={24}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
