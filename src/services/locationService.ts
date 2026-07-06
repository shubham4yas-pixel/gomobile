import { logger } from '@/lib/logger';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

/**
 * Location Service
 *
 * Thin wrappers over expo-location APIs.
 * All functions are safe — they catch errors and return structured results.
 */

type PermissionResult = {
  granted: boolean;
  status: 'granted' | 'denied' | 'undetermined';
};

type PositionResult = {
  latitude: number;
  longitude: number;
} | null;

/**
 * Request foreground location permission from the user.
 */
export async function requestLocationPermission(): Promise<PermissionResult> {
  if (Platform.OS === 'web') {
    return { granted: true, status: 'granted' };
  }
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return {
      granted: status === 'granted',
      status: status as PermissionResult['status'],
    };
  } catch (error) {
    logger.warn('Location permission request failed:', error);
    return { granted: false, status: 'denied' };
  }
}

/**
 * Get the device's current GPS position.
 * Returns null if location cannot be determined.
 */
export async function getCurrentPosition(): Promise<PositionResult> {
  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  } catch (error) {
    logger.warn('Failed to get current position:', error);
    if (Platform.OS === 'web') {
      logger.debug('Using mock web location fallback');
      return {
        latitude: 37.7749,
        longitude: -122.4194,
      };
    }
    return null;
  }
}

/**
 * Watch for device GPS position updates.
 */
export async function watchPosition(
  onLocationUpdate: (coords: { latitude: number; longitude: number }) => void
): Promise<{ remove: () => void } | null> {
  try {
    const subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 3000,
        distanceInterval: 5,
      },
      (location) => {
        onLocationUpdate({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
    );
    return subscription;
  } catch (error) {
    logger.warn('Failed to watch position:', error);
    return null;
  }
}
