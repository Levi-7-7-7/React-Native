/**
 * @format
 */
import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import notifee, { EventType } from '@notifee/react-native';
import messaging from '@react-native-firebase/messaging';
import { showCertificateNotification, setupNotifications } from './src/utils/notificationService';

// ─── BACKGROUND / KILLED STATE HANDLERS ──────────────────────────────────────
// These run in a headless JS context when the app is not in the foreground.
// They MUST be registered here in index.js, not inside App.tsx or any component.

// Required by Notifee — handles background button presses on Notifee notifications.
notifee.onBackgroundEvent(async ({ type, detail }) => {
  // No custom actions for now — required registration to avoid Notifee errors.
});

// Handles FCM data-only messages when app is background or killed.
// (Notification messages are shown automatically by FCM; this is for data messages.)
messaging().setBackgroundMessageHandler(async remoteMessage => {
//   const status = remoteMessage.data?.status;
//   const title = remoteMessage.notification?.title || 'Certificate Update';
//   const body  = remoteMessage.notification?.body  || '';
//   if (status === 'approved' || status === 'rejected') {
//     await setupNotifications();
//     await showCertificateNotification({ title, body, status });
//   }
});
// ─────────────────────────────────────────────────────────────────────────────

AppRegistry.registerComponent(appName, () => App);
