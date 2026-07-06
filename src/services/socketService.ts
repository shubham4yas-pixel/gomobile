import { logger } from '@/lib/logger';
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let currentUserId: string | null = null;

import { Platform } from 'react-native';
import { auth as firebaseAuth } from '@/config/firebase';

// Backend URL. Prefers EXPO_PUBLIC_SOCKET_URL (an ngrok HTTPS tunnel or a deployed
// backend) so standalone APKs reach the server off-LAN and over HTTPS — avoiding
// Android's cleartext-HTTP block. Falls back to the platform dev defaults when
// unset. EXPO_PUBLIC_* vars are inlined at build time by Expo.
const SOCKET_URL =
  process.env.EXPO_PUBLIC_SOCKET_URL ??
  (Platform.OS === 'web' ? 'http://localhost:3001' : 'http://10.243.3.247:3001');

/** The backend URL this client is dialing (for debug overlays / diagnostics). */
export const getSocketUrl = (): string => SOCKET_URL;

/** Whether the socket is currently connected (non-reactive snapshot). */
export const isSocketConnected = (): boolean => !!socket?.connected;

export const connectSocket = (
  role: 'rider' | 'driver' | 'admin',
  userId: string,
  phone?: string | null
) => {
  if (socket) {
    if (currentUserId === userId) {
      logger.debug(`[Socket] Reusing existing connection for ${userId}`);
      return socket;
    }
    logger.debug(`[Socket] Tearing down connection for ${currentUserId || 'unknown'} to connect ${userId}`);
    socket.disconnect();
  }

  currentUserId = userId;

  // Use websocket transport directly for instant connection and lower overhead.
  // `phone` (Phase 12) rides along in the handshake for the mutual contact
  // exchange when a driver accepts a trip.
  //
  // Auth (Phase 16): the handshake carries the Firebase ID token so the server
  // can verify identity instead of trusting the query. `auth` is a callback so
  // Socket.IO re-evaluates it on EVERY reconnection attempt — ID tokens expire
  // after 1h, and getIdToken() transparently refreshes a stale one. The query
  // params remain as a fallback for servers running without Admin credentials.
  socket = io(SOCKET_URL, {
    auth: (cb) => {
      const user = firebaseAuth?.currentUser;
      if (!user) {
        cb({ token: '', role, phone: phone ?? '' });
        return;
      }
      user
        .getIdToken()
        .then((token) => cb({ token, role, phone: phone ?? '' }))
        .catch(() => cb({ token: '', role, phone: phone ?? '' }));
    },
    query: { role, userId, phone: phone ?? '' },
    transports: ['websocket'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.io.on('reconnect_attempt', (attempt) => {
    logger.debug(`[Socket] Reconnect attempt ${attempt} for ${userId} (${role})`);
  });

  socket.io.on('reconnect', (attempt) => {
    logger.debug(`[Socket] Reconnected after ${attempt} attempts`);
  });

  socket.io.on('reconnect_error', (error) => {
    logger.warn(`[Socket] Reconnect error:`, error.message);
  });

  socket.io.on('reconnect_failed', () => {
    logger.error(`[Socket] Reconnect failed completely`);
  });

  socket.on('connect', () => {
    const transport = socket?.io?.engine?.transport?.name || 'unknown';
    logger.debug(`[Socket] Connected as ${role} (userId: ${userId}) on transport: ${transport}`);

    socket?.io?.engine?.on('upgrade', () => {
      const newTransport = socket?.io?.engine?.transport?.name;
      logger.debug(`[Socket] Transport upgraded to ${newTransport}`);
    });
  });

  socket.on('disconnect', (reason) => {
    logger.debug(`[Socket] Disconnected from server (userId: ${userId}). Reason:`, reason);
  });

  socket.on('connect_error', (error) => {
    logger.warn(`[Socket] Connection error (userId: ${userId}):`, error.message);
  });

  return socket;
};

export const getSocket = (): Socket | null => socket;

export const emitLocation = (lat: number, lng: number) => {
  if (!socket || !socket.connected) {
    logger.warn('[Socket] Cannot emit location, socket not connected');
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
    logger.warn('[Socket] Cannot register push token, socket not connected');
    return;
  }
  socket.emit('push:register-token', { token });
  logger.debug('[Socket] Emitted push:register-token');
};

/** Register this device's native FCM token for data-only messages (Phase 15). */
export const emitRegisterFcmToken = (token: string) => {
  if (!socket || !socket.connected) {
    logger.warn('[Socket] Cannot register FCM token, socket not connected');
    return;
  }
  socket.emit('push:register-fcm-token', { token });
  logger.debug('[Socket] Emitted push:register-fcm-token');
};

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ TRIP LIFECYCLE HELPERS ════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

/** Third-party booking metadata sent with a trip request (Phase 12). */
export type BookingForPayload = { isThirdParty: boolean; riderPhoneNumber: string | null };

/** Authorized escrow payment reference sent with a trip request (Phase 13). */
export type PaymentRefPayload = { orderId: string | null; paymentId: string };

/** A wire-format coordinate. `address` (Phase 14) is the human-readable label
 *  captured at booking time — it rides along into the persisted trip doc so the
 *  rider's ride history can show "from → to" without a reverse-geocode. */
export type TripPointPayload = { lat: number; lng: number; address?: string | null };

/** Rider: Request a new trip */
export const emitTripRequest = (
  pickup: TripPointPayload,
  dropoff: TripPointPayload,
  route?: { distanceKm: number; durationMin: number },
  bookingFor?: BookingForPayload,
  payment?: PaymentRefPayload
) => {
  if (!socket || !socket.connected) {
    logger.warn('[Socket] Cannot request trip, socket not connected');
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
  logger.debug('[Socket] Emitted trip:request');
};

/** Rider: Cancel a pending trip */
export const emitTripCancel = (tripId: string) => {
  if (!socket || !socket.connected) return;
  socket.emit('trip:cancel', { tripId });
  logger.debug('[Socket] Emitted trip:cancel');
};

/** Driver: Accept a trip offer */
export const emitTripAccept = (tripId: string) => {
  if (!socket || !socket.connected) return;
  socket.emit('trip:accept', { tripId });
  logger.debug('[Socket] Emitted trip:accept');
};

/** Driver: Reject a trip offer */
export const emitTripReject = (tripId: string) => {
  if (!socket || !socket.connected) return;
  socket.emit('trip:reject', { tripId });
  logger.debug('[Socket] Emitted trip:reject');
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
  logger.debug(`[Socket] Emitted trip:status-update → ${status}`);
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
  logger.debug(`[Socket] Emitted trip:submit-rating → ${rating}★`);
};

/**
 * Admin: listen for the full-state `admin:sync` snapshot.
 * Returns an unsubscribe function.
 */
export const onAdminSync = (
  callback: (data: { drivers: any[]; trips: any[]; serverTime: number }) => void
): (() => void) => {
  if (!socket) {
    logger.warn('[Socket] Cannot register admin listener, socket not initialized');
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
    logger.warn('[Socket] Cannot register listener, socket not initialized');
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
    logger.debug('[Socket] Disconnected and cleared');
  }
};
