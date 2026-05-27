/**
 * useTutorFcmToken.ts
 *
 * Mirrors useFcmToken.ts (for students) but registers the device token
 * against the tutor account so the backend can push "new certificate
 * uploaded" alerts to the tutor's device.
 *
 * Usage: call this once inside TutorTabNavigator (or any component that
 * mounts when the tutor is logged in).
 */
import {useEffect} from 'react';
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import tutorAxios from '../api/tutorAxios';
import {
  setupNotifications,
  showCertificateNotification,
  showNewCertificateNotification,
} from './notificationService';

const TUTOR_FCM_TOKEN_KEY = 'tutor_fcm_device_token';

export function useTutorFcmToken(onNewCertificate?: () => void) {
  useEffect(() => {
    // Step 1: Ensure notification channel + permission exist
    setupNotifications().catch(console.warn);

    // Step 2: Get & register device token with tutor backend endpoint
    const registerToken = async () => {
      try {
        const authStatus = await messaging().requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;
        if (!enabled) return;

        const token = await messaging().getToken();
        if (!token) return;

        const cached = await AsyncStorage.getItem(TUTOR_FCM_TOKEN_KEY);
        if (cached === token) return; // already registered

        await tutorAxios.patch('/tutors/fcm-token', {fcmToken: token});
        await AsyncStorage.setItem(TUTOR_FCM_TOKEN_KEY, token);
        console.log('[FCM] Tutor token registered');
      } catch (err) {
        console.warn('[FCM] Tutor token registration failed:', err);
      }
    };

    registerToken();

    // Step 3: Show local notification when FCM arrives in FOREGROUND
    const unsubForeground = messaging().onMessage(async remoteMessage => {
      const type = remoteMessage.data?.type as string | undefined;

      if (type === 'new_certificate') {
        // New certificate uploaded by a student — alert the tutor
        await showNewCertificateNotification({
          title: remoteMessage.notification?.title || '📄 New Certificate',
          body: remoteMessage.notification?.body || 'A student submitted a certificate.',
        });
        // Tell TutorTabNavigator so it can bump the badge count
        onNewCertificate?.();
      } else {
        // Fallback: certificate status change (shouldn't reach tutor device but just in case)
        const status = remoteMessage.data?.status as 'approved' | 'rejected' | undefined;
        if (status) {
          await showCertificateNotification({
            title: remoteMessage.notification?.title || 'Certificate Update',
            body: remoteMessage.notification?.body || '',
            status,
          });
        }
      }
    });

    // Step 4: Handle token rotation
    const unsubRefresh = messaging().onTokenRefresh(async newToken => {
      try {
        await tutorAxios.patch('/tutors/fcm-token', {fcmToken: newToken});
        await AsyncStorage.setItem(TUTOR_FCM_TOKEN_KEY, newToken);
      } catch (err) {
        console.warn('[FCM] Tutor token refresh failed:', err);
      }
    });

    return () => {
      unsubForeground();
      unsubRefresh();
    };
  }, [onNewCertificate]);
}
