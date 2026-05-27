# ActivityPoints Native

A React Native mobile application for **SBTE Kerala** students and tutors to track, upload, and manage mandatory activity points — fully aligned with the official SBTE Kerala activity points scheme.

> Students upload certificates, tutors review and approve them, and the app automatically calculates capped points per category against the required threshold to determine eligibility.

---

## Features

### Student
- **Unified Authentication** — Single login screen with JWT-based auth, OTP verification, forgot password, and reset password flows
- **Activity Points Dashboard** — Real-time points tally with a visual progress bar, calculated against the SBTE Kerala pass threshold (60 pts regular / 40 pts lateral entry)
- **Category-Capped Scoring** — Points engine mirrors the official SBTE rules: per-category caps, arts/sports/games max-of-best logic, and lateral entry adjustments
- **Certificate Management** — Upload, browse, and filter certificates by approval status (Approved / Pending / Rejected)
- **Profile Management** — View and update profile with avatar (camera or gallery), with live tutor info fetched from the backend
- **Push Notifications** — Firebase Cloud Messaging (FCM) notifies students instantly when a tutor approves or rejects a certificate

### Tutor
- **Tutor Dashboard** — Swipeable tab interface with Students, Upload CSV, Pending, and Approved sections
- **Student Management** — Browse all assigned students, view individual student details and their certificate history
- **Certificate Review** — Approve or reject pending certificates with a single action
- **CSV Upload** — Bulk-import student records via CSV file upload
- **Pending Badge** — Live badge counter on the Pending tab increments in real-time when new certificates arrive
- **Push Notifications** — FCM notifies tutors when a student submits a new certificate

### General
- **Dark Mode** — Full theme support via a centralized theme context
- **Swipe Navigation** — Gesture-driven tab navigation with spring animations and a sliding indicator
- **Offline-Resilient Auth** — Session is preserved on network errors; only a 401 forces a logout
- **Lottie Animations** — Smooth loading and state transition animations

---

## Tech Stack

| Layer | Library / Version |
|---|---|
| Framework | React Native 0.85.3 |
| Language | TypeScript 5.8 |
| Runtime | React 19.2.3 |
| Navigation | React Navigation 7 (Native Stack + Custom Tab Navigator) |
| HTTP Client | Axios 1.16 |
| Auth Storage | AsyncStorage 1.23 |
| Animations | React Native Reanimated 4.3 + Lottie 7.3 |
| Gestures | React Native Gesture Handler 2.31 |
| Push Notifications | Firebase Messaging 24 + Notifee 9 |
| Document Picker | `@react-native-documents/picker` 12 |
| Image Picker | `react-native-image-picker` 8.2 |
| Image Resizer | `react-native-image-resizer` 1.4 |
| File System | `react-native-fs` 2.20 |
| PDF Generation | `react-native-html-to-pdf` 1.3 |
| Sharing | `react-native-share` 12.3 |
| Icons | `react-native-vector-icons` 10.3 (MaterialCommunityIcons) |
| Date Picker | `@react-native-community/datetimepicker` 8.3 |
| Events | `eventemitter3` 5.0 |

### Android
| Setting | Value |
|---|---|
| Min SDK | 24 (Android 7.0) |
| Compile / Target SDK | 36 |
| Kotlin | 2.1.20 |

---

## Project Structure

```
src/
├── api/
│   ├── axiosInstance.ts        # Student Axios config — injects Bearer token, handles 401
│   └── tutorAxios.ts           # Tutor Axios config — separate token key, same 401 logic
├── context/
│   └── AuthContext.tsx         # Global auth state (user, role, loading, logout)
├── navigation/
│   ├── RootNavigator.tsx       # Auth gate — routes to StudentApp, TutorApp, or Login stack
│   ├── StudentTabNavigator.tsx # Swipeable tabs: Dashboard / Certificates / Upload
│   └── TutorTabNavigator.tsx   # Swipeable tabs: Students / Upload CSV / Pending / Approved
├── screens/
│   ├── UnifiedLoginScreen.tsx        # Single entry point for student & tutor login
│   ├── VerifyOtpScreen.tsx
│   ├── ForgotPasswordScreen.tsx
│   ├── ResetPasswordScreen.tsx
│   ├── TutorForgotPasswordScreen.tsx
│   ├── LoadingScreen.tsx             # Splash/loading state during auth init
│   ├── DashboardScreen.tsx           # Points summary, progress bar, recent activity
│   ├── CertificatesScreen.tsx        # Full certificate list with status filters
│   ├── UploadCertificateScreen.tsx
│   ├── ProfileScreen.tsx             # Student profile, avatar picker, tutor info
│   ├── TutorStudentsScreen.tsx       # Student list with search and PDF export
│   ├── TutorStudentDetailsScreen.tsx # Individual student certificate history
│   ├── TutorUploadCSVScreen.tsx      # Bulk student import via CSV
│   ├── TutorPendingScreen.tsx        # Certificates awaiting review
│   ├── TutorApprovedScreen.tsx       # Approved certificate history
│   └── TutorProfileScreen.tsx        # Tutor profile and avatar management
├── theme/
│   └── index.ts                # Light / dark colour tokens + useTheme hook
└── utils/
    ├── calcPoints.ts           # SBTE Kerala points calculation engine
    ├── notificationService.ts  # Notifee local notification display + channel setup
    ├── tabEvents.ts            # EventEmitter3 cross-tab event bus
    ├── useFcmToken.ts          # FCM token registration hook (student)
    └── useTutorFcmToken.ts     # FCM token registration hook (tutor)
```

---

## Getting Started

### Prerequisites

- **Node** ≥ 22.11.0
- **React Native CLI** environment ([official guide](https://reactnative.dev/docs/set-up-your-environment))
- **Android:** Android Studio with an emulator or physical device (API level 24+)
- **iOS:** Xcode 15+ (macOS only)

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

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com/)
2. Add an **Android** app → download `google-services.json` → place at `android/app/google-services.json`
3. Add an **iOS** app → download `GoogleService-Info.plist` → place inside `ios/ActivityPointsNative/`
4. Enable **Cloud Messaging** in your Firebase project

### API Configuration

The app ships pointing to a hosted backend. To use your own:

```ts
// src/api/axiosInstance.ts  (student)
export const BASE_URL = 'https://your-api-domain.com/api';

// src/api/tutorAxios.ts  (tutor)
export const BASE_URL = 'https://your-api-domain.com/api';
```

Both files share the same `BASE_URL` value — update both when switching environments.

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

**Special rule — Arts, Sports & Games:** Only the single highest-scoring certificate counts (not the sum). All other categories accumulate approved certificate points up to their per-category cap.

**Custom category ceilings:** If a category has an explicit `maxPoints` value set by the admin that differs from the default, that value is used as the ceiling (clamped to the per-segment cap for lateral entry students).

---

## Navigation Architecture

```
RootNavigator
├── (unauthenticated)
│   ├── UnifiedLoginScreen      ← student or tutor login
│   ├── VerifyOtpScreen
│   ├── ForgotPasswordScreen
│   ├── ResetPasswordScreen
│   └── TutorForgotPasswordScreen
│
├── (role = student)  StudentStackNavigator
│   ├── StudentTabNavigator     ← swipeable tabs
│   │   ├── DashboardScreen
│   │   ├── CertificatesScreen
│   │   └── UploadCertificateScreen
│   └── ProfileScreen           ← full-screen, no tab bar
│
└── (role = tutor)  TutorStackNavigator
    ├── TutorTabNavigator       ← swipeable tabs
    │   ├── TutorStudentsScreen
    │   ├── TutorUploadCSVScreen
    │   ├── TutorPendingScreen
    │   └── TutorApprovedScreen
    ├── TutorProfileScreen      ← full-screen, no tab bar
    └── TutorStudentDetailsScreen
```

---

## Notification Flow

```
Student submits certificate
        │
        ▼
Backend fires FCM push → Tutor device
(pending badge increments live if app is open)

Tutor approves / rejects certificate
        │
        ▼
Backend fires FCM push → Student device
        │
   ┌────┴────┐
   │         │
App open   App backgrounded / killed
   │         │
Notifee    FCM system tray notification
foreground  (tap → opens app, navigates to Dashboard)
```

---

## Scripts

| Command | Description |
|---|---|
| `npm start` | Start Metro bundler |
| `npm run android` | Run on Android device/emulator |
| `npm run ios` | Run on iOS simulator (macOS only) |
| `npm run lint` | Run ESLint |
| `npm test` | Run Jest tests |

---

## Testing

```bash
npm test
```

Tests live in `__tests__/` and use `@react-native/jest-preset` with React Test Renderer.

---

## Contributing

Fork the repository and open a pull request. Please follow the existing ESLint and Prettier configuration before submitting.

---

## License

This project is private. All rights reserved.

---

## Related
- [Activity-points-calculation-file](https://sitttrkerala.ac.in/syllabus/rev2021/activity-rev2021.pdf) — activity-rev2021.pdf
- [SBTE Kerala](https://www.sbte.kerala.gov.in/) — State Board of Technical Education, Kerala
- [ActivityPoints Web Frontend](https://apmsv1.onrender.com) — Companion web app for tutors and admins