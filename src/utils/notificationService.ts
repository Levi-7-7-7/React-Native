/**
 * notificationService.ts
 *
 * Handles LOCAL (foreground) notifications via Notifee.
 * FCM delivers notifications in background/killed state automatically
 * through react-native-firebase — no Notifee needed for that path.
 *
 * This file is called by useFcmToken.ts when a FCM message arrives
 * while the app IS in the foreground (FCM suppresses its own UI then).
 */
import notifee, {
  AndroidImportance,
  AndroidVisibility,
  AuthorizationStatus,
} from '@notifee/react-native';

export const CHANNEL_ID = 'certificate_status';

// Only creates the channel — safe to call from headless/background context
export async function setupNotificationChannel(): Promise<void> {
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Certificate Status',
    description: 'Notifies you when a certificate is approved or rejected.',
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    vibration: true,
    lights: true,
  });
}

// Requests permission — must only be called when UI is available (NOT from index.js)
export async function setupNotifications(): Promise<void> {
  await setupNotificationChannel();
  const settings = await notifee.requestPermission();
  if (settings.authorizationStatus < AuthorizationStatus.AUTHORIZED) {
    console.warn('[Notifications] Permission not granted');
  }
}

export async function showCertificateNotification(params: {
  title: string;
  body: string;
  status: 'approved' | 'rejected';
}): Promise<void> {
  await notifee.displayNotification({
    title: params.title,
    body: params.body,
    android: {
      channelId: CHANNEL_ID,
      importance: AndroidImportance.HIGH,
      smallIcon: 'ic_stat_notification',
      color: params.status === 'approved' ? '#16a34a' : '#dc2626',
      pressAction: {
        id: 'default',
        launchActivity: 'default',
      },
    },
    ios: {
      sound: 'default',
      foregroundPresentationOptions: {
        alert: true,
        badge: true,
        sound: true,
      },
    },
  });
}

/** Shown to the TUTOR when a student uploads a new certificate. */
export async function showNewCertificateNotification(params: {
  title: string;
  body: string;
}): Promise<void> {
  await notifee.displayNotification({
    title: params.title,
    body: params.body,
    android: {
      channelId: CHANNEL_ID,
      importance: AndroidImportance.HIGH,
      smallIcon: 'ic_stat_notification',
      color: '#2563eb',
      pressAction: {
        id: 'default',
        launchActivity: 'default',
      },
    },
    ios: {
      sound: 'default',
      foregroundPresentationOptions: {
        alert: true,
        badge: true,
        sound: true,
      },
    },
  });
}
