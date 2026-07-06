import { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * Dynamic app config (Phase 17 — the two-app split).
 *
 * EXPO_PUBLIC_APP_VARIANT selects which app this build IS:
 *   rider  → "RideShare"        com.rideshare.rider
 *   driver → "RideShare Driver" com.rideshare.driver
 *   unset  → universal dev app  com.anonymous.uberclone (original id)
 *
 * The slug and EAS projectId are shared — both apps live in one Expo project.
 *
 * ⚠️ Before the FIRST rider/driver build: add Android apps for BOTH new package
 * names in the Firebase console (with the EAS keystore SHA-1s) and download the
 * merged google-services.json — the Gradle plugin picks the client matching the
 * applicationId, and the build fails if it's missing.
 */

type Variant = 'rider' | 'driver' | 'universal';

const VARIANT: Variant = (['rider', 'driver'].includes(
  process.env.EXPO_PUBLIC_APP_VARIANT ?? ''
)
  ? process.env.EXPO_PUBLIC_APP_VARIANT
  : 'universal') as Variant;

const IDENTITY: Record<
  Variant,
  { name: string; androidPackage: string; iosBundleId: string; scheme: string; splashColor: string }
> = {
  rider: {
    name: 'RideShare',
    androidPackage: 'com.rideshare.rider',
    iosBundleId: 'com.rideshare.rider',
    scheme: 'rideshare',
    splashColor: '#1E3A8A',
  },
  driver: {
    name: 'RideShare Driver',
    androidPackage: 'com.rideshare.driver',
    iosBundleId: 'com.rideshare.driver',
    scheme: 'ridesharedriver',
    splashColor: '#0A1B3D',
  },
  universal: {
    name: 'mobile-app',
    androidPackage: 'com.anonymous.uberclone',
    iosBundleId: 'com.anonymous.uberclone',
    scheme: 'mobileapp',
    splashColor: '#1E3A8A',
  },
};

const identity = IDENTITY[VARIANT];

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: identity.name,
  slug: 'mobile-app', // shared EAS project — do not change per variant
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: identity.scheme,
  userInterfaceStyle: 'automatic',
  ios: {
    icon: './assets/expo.icon',
    bundleIdentifier: identity.iosBundleId,
    config: {
      googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    },
  },
  android: {
    package: identity.androidPackage,
    googleServicesFile: './google-services.json',
    config: {
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',
      },
    },
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    permissions: [
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_FINE_LOCATION',
    ],
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: identity.splashColor,
        android: {
          image: './assets/images/splash-icon.png',
          imageWidth: 76,
        },
      },
    ],
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'RideShare needs your location to show your position on the map and match you with nearby rides.',
      },
    ],
    [
      'expo-notifications',
      {
        color: '#1E3A8A',
        icon: './assets/images/android-icon-monochrome.png',
      },
    ],
    'expo-font',
    'expo-web-browser',
    'expo-build-properties',
    '@react-native-google-signin/google-signin',
    '@react-native-firebase/app',
    '@react-native-firebase/messaging',
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    router: {},
    eas: {
      projectId: 'c1b9f652-8ce9-410f-899e-38e03ac5d4f9',
    },
    appVariant: VARIANT,
  },
});
