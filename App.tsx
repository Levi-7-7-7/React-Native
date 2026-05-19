import React, {useEffect, useRef} from 'react';
import {StatusBar} from 'react-native';
import {NavigationContainer, NavigationContainerRef} from '@react-navigation/native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import notifee, {EventType} from '@notifee/react-native';
import messaging from '@react-native-firebase/messaging';
import {AuthProvider, useAuth} from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';

// Inner component so it can access useAuth()
function AppInner({navigationRef}: {navigationRef: React.RefObject<NavigationContainerRef<any> | null>}) {
  const {role, loading} = useAuth();
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
      navigationRef.current?.navigate('StudentApp', {screen: 'Dashboard'});
    } catch (e) {
      console.warn('[Nav] Navigate failed:', e);
    }
    notificationPending.current = false;
  };

  // Re-attempt when auth resolves
  useEffect(() => {
    if (!loading && notificationPending.current) {
      setTimeout(() => goToCertificates(), 20000);
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
  );
}

export default function App() {
  const navigationRef = useRef<NavigationContainerRef<any>>(null);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#f0f4ff" />
      <AuthProvider>
        <AppInner navigationRef={navigationRef} />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
