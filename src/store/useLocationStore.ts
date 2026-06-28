import { create } from 'zustand';

/**
 * Location Store (Zustand)
 *
 * Holds the user's GPS coordinates, permission status, error messages,
 * and tracking state. Updated by the map screen via locationService helpers.
 */

export interface DriverPosition {
  id: string;
  lat: number;
  lng: number;
  updatedAt: number;
}

interface LocationState {
  // State
  userLocation: {
    latitude: number;
    longitude: number;
  } | null;
  errorMsg: string | null;
  isTracking: boolean;
  permissionStatus: 'undetermined' | 'granted' | 'denied';
  nearbyDrivers: DriverPosition[];

  // Actions
  setLocation: (latitude: number, longitude: number) => void;
  setError: (msg: string | null) => void;
  setTracking: (value: boolean) => void;
  setPermissionStatus: (status: 'undetermined' | 'granted' | 'denied') => void;
  setNearbyDrivers: (drivers: DriverPosition[]) => void;
  reset: () => void;
}

export const useLocationStore = create<LocationState>((set) => ({
  // Initial state
  userLocation: null,
  errorMsg: null,
  isTracking: false,
  permissionStatus: 'undetermined',
  nearbyDrivers: [],

  // Actions
  setLocation: (latitude, longitude) =>
    set({ userLocation: { latitude, longitude }, errorMsg: null }),

  setError: (msg) => set({ errorMsg: msg }),

  setTracking: (value) => set({ isTracking: value }),

  setPermissionStatus: (status) => set({ permissionStatus: status }),

  setNearbyDrivers: (drivers) => set({ nearbyDrivers: drivers }),

  reset: () =>
    set({
      userLocation: null,
      errorMsg: null,
      isTracking: false,
      permissionStatus: 'undetermined',
      nearbyDrivers: [],
    }),
}));
