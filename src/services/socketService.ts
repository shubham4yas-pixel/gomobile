import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let currentUserId: string | null = null;

import { Platform } from 'react-native';

const SOCKET_URL = Platform.OS === 'web'
  ? 'http://localhost:3001'
  : 'http://10.243.3.247:3001';

export const connectSocket = (
  role: 'rider' | 'driver' | 'admin',
  userId: string,
  phone?: string | null
) => {
  if (socket) {
    socket.disconnect();
  }

  currentUserId = userId;

  // Use websocket transport directly for instant connection and lower overhead.
  // `phone` (Phase 12) rides along in the handshake for the mutual contact
  // exchange when a driver accepts a trip.
  socket = io(SOCKET_URL, {
    query: { role, userId, phone: phone ?? '' },
    transports: ['websocket'],
    autoConnect: true,
  });

  socket.on('connect', () => {
    console.log(`[Socket] Connected as ${role} (userId: ${userId})`);
  });

  socket.on('disconnect', (reason) => {
    console.log(`[Socket] Disconnected from server:`, reason);
  });

  socket.on('connect_error', (error) => {
    console.warn(`[Socket] Connection error:`, error);
  });

  return socket;
};

export const getSocket = (): Socket | null => socket;

export const emitLocation = (lat: number, lng: number) => {
  if (!socket || !socket.connected) {
    console.warn('[Socket] Cannot emit location, socket not connected');
    return;
  }
  socket.emit('driver:update-location', {
    id: currentUserId,
    lat,
    lng,
  });
};

/** Register this device's Expo push token with the server (Phase 12). */
export const emitRegisterPushToken = (token: string) => {
  if (!socket || !socket.connected) {
    console.warn('[Socket] Cannot register push token, socket not connected');
    return;
  }
  socket.emit('push:register-token', { token });
  console.log('[Socket] Emitted push:register-token');
};

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ TRIP LIFECYCLE HELPERS ════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

/** Third-party booking metadata sent with a trip request (Phase 12). */
export type BookingForPayload = { isThirdParty: boolean; riderPhoneNumber: string | null };

/** Authorized escrow payment reference sent with a trip request (Phase 13). */
export type PaymentRefPayload = { orderId: string | null; paymentId: string };

/** Rider: Request a new trip */
export const emitTripRequest = (
  pickup: { lat: number; lng: number },
  dropoff: { lat: number; lng: number },
  route?: { distanceKm: number; durationMin: number },
  bookingFor?: BookingForPayload,
  payment?: PaymentRefPayload
) => {
  if (!socket || !socket.connected) {
    console.warn('[Socket] Cannot request trip, socket not connected');
    return;
  }
  // Forward the rider's real Directions-derived distance/duration estimate (Phase 11),
  // the third-party booking object (Phase 12), and the authorized payment ref (Phase 13).
  socket.emit('trip:request', {
    pickup,
    dropoff,
    ...(route ?? {}),
    ...(bookingFor ? { bookingFor } : {}),
    ...(payment ? { payment } : {}),
  });
  console.log('[Socket] Emitted trip:request');
};

/** Rider: Cancel a pending trip */
export const emitTripCancel = (tripId: string) => {
  if (!socket || !socket.connected) return;
  socket.emit('trip:cancel', { tripId });
  console.log('[Socket] Emitted trip:cancel');
};

/** Driver: Accept a trip offer */
export const emitTripAccept = (tripId: string) => {
  if (!socket || !socket.connected) return;
  socket.emit('trip:accept', { tripId });
  console.log('[Socket] Emitted trip:accept');
};

/** Driver: Reject a trip offer */
export const emitTripReject = (tripId: string) => {
  if (!socket || !socket.connected) return;
  socket.emit('trip:reject', { tripId });
  console.log('[Socket] Emitted trip:reject');
};

/** Driver: Update trip status (ARRIVED, IN_PROGRESS, COMPLETED).
 *  On COMPLETED, `extra` carries the real driving distance/duration (Phase 11). */
export const emitTripStatusUpdate = (
  tripId: string,
  status: string,
  extra?: { distanceKm: number; durationMin: number }
) => {
  if (!socket || !socket.connected) return;
  socket.emit('trip:status-update', { tripId, status, ...(extra ?? {}) });
  console.log(`[Socket] Emitted trip:status-update → ${status}`);
};

/** Rider/Driver: Submit a post-trip rating (Phase 9). Receive side uses onTripEvent('trip:receipt'). */
export const emitSubmitRating = (
  tripId: string,
  userId: string,
  rating: number,
  role: string
) => {
  if (!socket || !socket.connected) return;
  socket.emit('trip:submit-rating', { tripId, userId, rating, role });
  console.log(`[Socket] Emitted trip:submit-rating → ${rating}★`);
};

/**
 * Admin: listen for the full-state `admin:sync` snapshot.
 * Returns an unsubscribe function.
 */
export const onAdminSync = (
  callback: (data: { drivers: any[]; trips: any[]; serverTime: number }) => void
): (() => void) => {
  if (!socket) {
    console.warn('[Socket] Cannot register admin listener, socket not initialized');
    return () => {};
  }
  socket.on('admin:sync', callback);
  return () => {
    socket?.off('admin:sync', callback);
  };
};

/**
 * Register a listener for a trip event.
 * Returns an unsubscribe function.
 */
export const onTripEvent = (event: string, callback: (data: any) => void): (() => void) => {
  if (!socket) {
    console.warn('[Socket] Cannot register listener, socket not initialized');
    return () => {};
  }
  socket.on(event, callback);
  return () => {
    socket?.off(event, callback);
  };
};

export const disconnectSocket = () => {
  if (socket) {
    socket.emit('driver:go-offline');
    socket.disconnect();
    socket = null;
    currentUserId = null;
    console.log('[Socket] Disconnected and cleared');
  }
};
