# ActivityPoints Native

A React Native mobile application for **SBTE Kerala** students to track, upload, and manage their mandatory activity points — fully aligned with the official SBTE Kerala activity points scheme.

> Students upload certificates, tutors review them, and the app automatically calculates capped points per category against the required threshold to determine eligibility.

---

## Features

- **Secure Authentication** — JWT-based login with OTP verification, forgot password, and reset password flows
- **Activity Points Dashboard** — Real-time points tally with a visual progress bar, calculated against the SBTE Kerala pass threshold (60 pts regular / 40 pts lateral entry)
- **Category-Capped Scoring** — Points engine mirrors the official SBTE rules: per-category caps, arts/sports/games max-of-best logic, and lateral entry adjustments
- **Certificate Management** — Upload, browse, and view certificates with approval status (Approved / Pending / Rejected)
- **In-App Certificate Viewer** — View PDFs and images in a full-screen WebView without leaving the app
- **Push Notifications** — Firebase Cloud Messaging (FCM) notifies students instantly when a tutor approves or rejects a certificate
- **Dark Mode** — Full theme support via a centralized theme context
- **Offline-Resilient Auth** — Session is preserved on network errors; only a 401 forces a logout

---

## Tech Stack

| Layer | Library / Version |
|---|---|
| Framework | React Native 0.85.3 |
| Language | TypeScript 5.8 |
| Navigation | React Navigation 7 (Native Stack + Bottom Tabs) |
| HTTP Client | Axios 1.16 |
| Auth Storage | AsyncStorage |
| Push Notifications | Firebase Messaging 24 + Notifee 9 |
| Document Picker | `@react-native-documents/picker` |
| Image Picker | `react-native-image-picker` |
| Icons | `react-native-vector-icons` (MaterialCommunityIcons) |
| WebView | `react-native-webview` |
| Runtime | Node ≥ 22.11 |

---

## Project Structure

```
src/
├── api/
│   └── axiosInstance.ts        # Axios base config with auth token injection
├── context/
│   └── AuthContext.tsx         # Global auth state (user, role, logout)
├── navigation/
│   ├── RootNavigator.tsx       # Auth gate — routes to Login or StudentApp
│   └── StudentTabNavigator.tsx # Bottom tabs: Dashboard / Certificates / Upload
├── screens/
│   ├── LoginScreen.tsx
│   ├── VerifyOtpScreen.tsx
│   ├── ForgotPasswordScreen.tsx
│   ├── ResetPasswordScreen.tsx
│   ├── DashboardScreen.tsx     # Points summary, progress bar, recent activity
│   ├── CertificatesScreen.tsx  # Full certificate list with filters
│   ├── UploadCertificateScreen.tsx
│   └── CertificateViewerScreen.tsx
├── theme/
│   └── index.ts                # Light / dark colour tokens
└── utils/
    ├── calcPoints.ts           # SBTE Kerala points calculation engine
    ├── notificationService.ts  # Notifee local notification display
    └── useFcmToken.ts          # FCM token registration hook
```

---

## Getting Started

### Prerequisites

- **Node** ≥ 22.11.0
- **React Native CLI** environment set up ([official guide](https://reactnative.dev/docs/set-up-your-environment))
- For Android: Android Studio with an emulator or physical device
- For iOS: Xcode 15+ (macOS only)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/Levi-7-7-7/Native.git
cd ActivityPointsNative

# 2. Install dependencies
npm install

# 3. iOS only — install CocoaPods
cd ios && pod install && cd ..
```

### Firebase Setup

This app uses Firebase for push notifications. Before running:

1. Create a project in the [Firebase Console](https://console.firebase.google.com/)
2. Add an Android app and download `google-services.json` → place it at `android/app/google-services.json`
3. Add an iOS app and download `GoogleService-Info.plist` → place it inside `ios/ActivityPointsNative/`
4. Enable **Cloud Messaging** in your Firebase project

### Environment / API

Update the base URL in `src/api/axiosInstance.ts` to point to your backend:

```ts
// src/api/axiosInstance.ts
const axiosInstance = axios.create({
  baseURL: 'https://your-api-domain.com/api',
});
```

### Running the App

```bash
# Start the Metro bundler
npm start

# Android
npm run android

# iOS
npm run ios
```

---

## Points Calculation

The scoring engine (`src/utils/calcPoints.ts`) implements the official **SBTE Kerala Activity Points** rules:

| Student Type | Pass Threshold | Per-Category Cap |
|---|---|---|
| Regular | 60 points | 40 points |
| Lateral Entry | 40 points | 30 points |

**Special rule:** For Arts, Sports, and Games categories, only the **highest single certificate** counts (not the sum). All other categories sum approved certificate points up to the per-category cap.

---

## Notification Flow

```
Backend approves/rejects certificate
        │
        ▼
Firebase sends FCM push to student device
        │
   ┌────┴────┐
   │         │
App open   App in background/killed
   │         │
Notifee    FCM system notification
foreground  (tap → opens app & navigates to Dashboard)
```

---

## Scripts

| Command | Description |
|---|---|
| `npm start` | Start Metro bundler |
| `npm run android` | Run on Android |
| `npm run ios` | Run on iOS |
| `npm run lint` | Run ESLint |
| `npm test` | Run Jest tests |

---

## Testing

```bash
npm test
```

Tests live in `__tests__/`. The project uses `@react-native/jest-preset`.

---

## Contributing

Feel free to fork the project and submit pull requests.
Please follow the existing ESLint and Prettier configuration.

---

## License

This project is private. All rights reserved.

---

## Related

- [SBTE Kerala](https://www.sbte.kerala.gov.in/) — State Board of Technical Education, Kerala
- [ActivityPoints Web Frontend](https://github.com/your-org/activity-points-frontend) — Companion web app for tutors and admins
