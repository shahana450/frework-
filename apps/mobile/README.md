# FreWork Mobile App

React Native (Expo) app for frework.online — Android & iOS.

## Setup

```bash
cd apps/mobile
npm install
```

## Run (Development)

```bash
# Start Expo dev server
npm start

# Android (needs Android Studio + emulator or real device)
npm run android

# iOS (needs Xcode on Mac)
npm run ios
```

## Before first run — add Google credentials

In `app/_layout.tsx`, replace:
- `YOUR_WEB_CLIENT_ID` → from Google Cloud Console → OAuth 2.0 Credentials (Web Client)
- `YOUR_IOS_CLIENT_ID` → iOS Client ID from the same screen

In `app.json`:
- `YOUR_IOS_CLIENT_ID` in `iosUrlScheme`

## Build for production (Expo EAS)

```bash
npm install -g eas-cli
eas login
eas build:configure   # creates eas.json

# Android APK / AAB (for Play Store)
npm run build:android

# iOS IPA (for App Store)
npm run build:ios
```

## App Structure

```
app/
  _layout.tsx          Root layout, Google Sign-In config
  auth/login.tsx       Login screen
  (tabs)/
    _layout.tsx        Bottom tab navigator
    index.tsx          Home screen
    services.tsx       All services
    coworking.tsx      Browse coworking spaces
    freelancers.tsx    Hire talent
    profile.tsx        User profile + compliance calendar
components/
  WhatsAppFAB.tsx      Floating WhatsApp button
constants/
  index.ts             Data: services, spaces, freelancers, colors
```

## Key Features

- Google Sign-In
- WhatsApp deep-link for all bookings (no payment gateway needed for MVP)
- Compliance calendar with due date alerts
- City filter for coworking spaces
- Role filter for freelancers
- Dark navy theme matching frework.online
