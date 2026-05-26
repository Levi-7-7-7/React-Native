import React, {useEffect, useRef} from 'react';
import {StatusBar, Platform} from 'react-native';
import {NavigationContainer, NavigationContainerRef} from '@react-navigation/native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import notifee, {EventType} from '@notifee/react-native';
import messaging from '@react-native-firebase/messaging';
import {AuthProvider, useAuth} from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {useTheme} from './src/theme';

// Inner component so it can access useAuth() and useTheme()
function AppInner({navigationRef}: {navigationRef: React.RefObject<NavigationContainerRef<any> | null>}) {
  const {role, loading} = useAuth();
  const {colors, isDark} = useTheme();
  const notificationPending = useRef(false);
  const navReady = useRef(false);

  // Keep refs in sync so closures always read the latest value
  const roleRef = useRef(role);
  const loadingRef = useRef(loading);
  useEffect(() => { roleRef.current = role; }, [role]);
  useEffect(() => { loadingRef.current = loading; }, [loading]);

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
      navigationRef.current?.navigate('StudentApp', {screen: 'Certificates'});
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
      if (type === EventType.PRESS) goToCertificates();
    });

    const unsubFcm = messaging().onNotificationOpenedApp(() => {
      goToCertificates();
    });

    messaging().getInitialNotification().then(remoteMessage => {
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
      {/*
        ── Centralized StatusBar ──────────────────────────────────────────
        Single source of truth for the system status bar across ALL screens.

        • barStyle:        'dark-content' (dark icons) in light mode
                           'light-content' (white icons) in dark mode
                           — mirrors WhatsApp behaviour

        • backgroundColor: matches the app's background token so the bar
                           blends seamlessly on Android.

        • translucent:     false  → the status bar occupies real space;
                           React Native layouts start BELOW it, so no
                           content is ever hidden under the bar.

        • Android notch / edge-to-edge: handled automatically because
          translucent=false + SafeAreaProvider already insets content.
          The theme in styles.xml uses DayNight.NoActionBar which lets
          React Native own the window insets entirely.
      */}
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? '#0f172a' : '#f0f4ff'}
        translucent={false}
        animated={true}
      />

      <NavigationContainer
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
