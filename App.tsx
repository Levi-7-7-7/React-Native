import React, {useEffect, useRef} from 'react';
import {StatusBar} from 'react-native';
import {
  NavigationContainer,
  NavigationContainerRef,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import notifee, {EventType} from '@notifee/react-native';
import messaging from '@react-native-firebase/messaging';
import {AuthProvider, useAuth} from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {useTheme} from './src/theme';

// Inner component so it can access useAuth() and useTheme()
function AppInner({
  navigationRef,
}: {
  navigationRef: React.RefObject<NavigationContainerRef<any> | null>;
}) {
  const {role, loading} = useAuth();
  const {colors, isDark} = useTheme();

  const notificationPending = useRef(false);
  const navReady = useRef(false);

  // Navigation theme fix for Android transition background
  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: isDark ? '#0f172a' : '#f0f4ff',
      card: isDark ? '#0f172a' : '#ffffff',
      primary: colors.primary,
      text: isDark ? '#ffffff' : '#000000',
      border: isDark ? '#1e293b' : '#dbeafe',
    },
  };

  // Keep refs in sync so closures always read the latest value
  const roleRef = useRef(role);
  const loadingRef = useRef(loading);

  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  const goToCertificates = () => {
    if (!navReady.current || loadingRef.current) {
      notificationPending.current = true;
      return;
    }

    if (roleRef.current !== 'student') {
      notificationPending.current = false;
      return;
    }

    try {
      navigationRef.current?.navigate('StudentApp', {
        screen: 'Certificates',
      });
    } catch (e) {
      console.warn('[Nav] Navigate failed:', e);
    }

    notificationPending.current = false;
  };

  // Re-attempt when auth resolves
  useEffect(() => {
    if (!loading && notificationPending.current) {
      setTimeout(() => goToCertificates(), 500);
    }
  }, [loading, role]);

  useEffect(() => {
    const unsubNotifee = notifee.onForegroundEvent(({type}) => {
      if (type === EventType.PRESS) {
        goToCertificates();
      }
    });

    const unsubFcm = messaging().onNotificationOpenedApp(() => {
      goToCertificates();
    });

    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage) {
          notificationPending.current = true;
          goToCertificates();
        }
      });

    return () => {
      unsubNotifee();
      unsubFcm();
    };
  }, []);

  return (
    <>
      {/* Global StatusBar */}
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? '#0f172a' : '#f0f4ff'}
        translucent={false}
        animated={true}
      />

      <NavigationContainer
        theme={navTheme}
        ref={navigationRef}
        onReady={() => {
          navReady.current = true;

          if (notificationPending.current) {
            goToCertificates();
          }
        }}>
        <RootNavigator />
      </NavigationContainer>
    </>
  );
}

export default function App() {
  const navigationRef = useRef<NavigationContainerRef<any>>(null);

  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <SafeAreaProvider>
        <AuthProvider>
          <AppInner navigationRef={navigationRef} />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
