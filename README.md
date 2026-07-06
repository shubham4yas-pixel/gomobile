# GO RideShare Project

A modern, full-stack ride-sharing platform built with Expo (React Native), Firebase, and Socket.IO.

## Project Overview

This repository contains the `mobile-app` workspace which powers both the Rider and Driver applications through a unified, environment-variant architecture (`EXPO_PUBLIC_APP_VARIANT`). The application supports real-time location tracking, live driver matching, a complete trip state machine, and secure payments.

## Architecture

The system is separated into three logical domains:
- **Rider App**: Handles destination search, fare estimation, driver matching, and payment collection.
- **Driver App**: Handles incoming ride requests, navigation, ride lifecycle management, and earnings.
- **Backend (External)**: A Node.js/Express server managing the Socket.IO rooms, Razorpay payment webhooks, and Firebase Admin validation. (Note: currently stored outside this repository).

## Technologies

- **Frontend**: React Native, Expo, Reanimated 3, Gorhom Bottom Sheet
- **State/Data**: React Context, Firebase Auth, Firestore
- **Real-time**: Socket.IO client (`socket.io-client`)
- **Maps**: `react-native-maps`, Google Maps Directions API
- **Payments**: Razorpay
- **Styling**: Strict custom theme (`theme.ts`), Inter typography, Glassmorphism elements

## Folder Structure

```
mobile-app/
├── app.config.ts         # Expo configuration and variant switching
├── src/
│   ├── app/              # Expo Router pages (auth, main app)
│   ├── components/       # Reusable UI (BottomSheet, MapView, GlassCard)
│   ├── config/           # Firebase, Maps, and Variant initialisation
│   ├── lib/              # Utilities (logger, errorReporter)
│   ├── services/         # Socket, Auth, Ride state management
│   └── theme/            # Design system tokens and styles
└── docs/                 # QA Checklists and architecture notes
```

## Environment Variables

To run the mobile app, you must configure an `.env` file in the root of `mobile-app/`:

```env
# Google Maps
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_key

# Firebase
EXPO_PUBLIC_FIREBASE_API_KEY=your_firebase_key
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
# ... (standard Firebase config)

# App Variant (rider | driver)
EXPO_PUBLIC_APP_VARIANT=rider

# Backend
EXPO_PUBLIC_API_URL=http://your-local-ip:3000
```

## Installation & Running Locally

1. Install dependencies:
```bash
npm install
```

2. Start the Metro bundler:
```bash
# To run the Rider variant
EXPO_PUBLIC_APP_VARIANT=rider npx expo start

# To run the Driver variant
EXPO_PUBLIC_APP_VARIANT=driver npx expo start
```

## Building APKs

To build for production using Expo Application Services (EAS):

```bash
# Rider APK
eas build --profile production-rider --platform android

# Driver APK
eas build --profile production-driver --platform android
```

## Future Roadmap

- **Background Location**: Migrate JS-thread location tracking to native foreground services (Expo TaskManager/Location) for drivers.
- **Push Notifications**: Implement FCM for offline ping delivery.
- **Dynamic Pricing**: Integrate surge pricing models in the backend.
