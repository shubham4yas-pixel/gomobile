import { create } from 'zustand';

/**
 * Admin Store (Zustand)
 *
 * Holds the live "God Mode" snapshot pushed by the server's `admin:sync` event:
 * the full active-driver pool and active-trip registry. Kept separate from the
 * rider/driver stores since the dashboard observes the whole fleet, not a single
 * user's ride.
 */

export interface AdminDriver {
  id: string;
  lat: number;
  lng: number;
  busy: boolean;
  updatedAt: number;
}

export interface AdminTrip {
  id: string;
  riderId: string;
  driverId: string | null;
  status: 'SEARCHING' | 'OFFERED' | 'ACCEPTED' | 'ARRIVED' | 'IN_PROGRESS' | 'COMPLETED';
  pickup: { lat: number; lng: number };
  dropoff: { lat: number; lng: number };
  createdAt: number;
}

interface AdminState {
  liveDrivers: AdminDriver[];
  liveTrips: AdminTrip[];
  connected: boolean;
  lastSyncAt: number | null;

  setSync: (drivers: AdminDriver[], trips: AdminTrip[]) => void;
  setConnected: (value: boolean) => void;
  reset: () => void;
}

export const useAdminStore = create<AdminState>((set) => ({
  liveDrivers: [],
  liveTrips: [],
  connected: false,
  lastSyncAt: null,

  setSync: (drivers, trips) =>
    set({ liveDrivers: drivers, liveTrips: trips, lastSyncAt: Date.now() }),

  setConnected: (value) => set({ connected: value }),

  reset: () => set({ liveDrivers: [], liveTrips: [], connected: false, lastSyncAt: null }),
}));
