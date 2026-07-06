import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Marker } from '@/components/MapView';
import { Ionicons } from '@expo/vector-icons';
import { colors, elevationShadows } from '@/theme/theme';

interface LocationMarkerProps {
  coordinate: { latitude: number; longitude: number };
  address?: string | null;
  type: 'pickup' | 'dropoff';
  draggable?: boolean;
  onDragEnd?: (e: any) => void;
}

/**
 * A memoized static marker for Pickup or Dropoff locations.
 * Uses tracksViewChanges={false} to stop constant re-rendering.
 */
export const LocationMarker = memo(({ coordinate, address, type, draggable, onDragEnd }: LocationMarkerProps) => {
  const isPickup = type === 'pickup';
  const bgColor = isPickup ? colors.navy : colors.gold;

  return (
    <Marker
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 1 }}
      draggable={draggable}
      onDragEnd={onDragEnd}
      tracksViewChanges={false}
    >
      <View style={styles.pinWrap}>
        {address ? (
          <View style={styles.markerLabel}>
            <Text style={styles.markerLabelText} numberOfLines={1}>
              {address}
            </Text>
          </View>
        ) : null}
        <View style={[styles.pin, { backgroundColor: bgColor }]}>
          <Ionicons name={isPickup ? "person" : "flag"} size={isPickup ? 15 : 14} color={colors.white} />
        </View>
        <View style={[styles.pinStem, { backgroundColor: bgColor }]} />
      </View>
    </Marker>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.coordinate.latitude === nextProps.coordinate.latitude &&
    prevProps.coordinate.longitude === nextProps.coordinate.longitude &&
    prevProps.address === nextProps.address &&
    prevProps.draggable === nextProps.draggable
  );
});

LocationMarker.displayName = 'LocationMarker';

interface DriverMarkerProps {
  id: string;
  coordinate: { latitude: number; longitude: number };
  isAssigned: boolean;
}

/**
 * A memoized static marker for nearby drivers.
 * Uses tracksViewChanges={false} unless assigned, since assigned drivers move continuously.
 */
export const DriverMarker = memo(({ id, coordinate, isAssigned }: DriverMarkerProps) => {
  return (
    <Marker
      key={id}
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={isAssigned} // Only track changes if this is the actively moving assigned car
    >
      <View style={styles.driverMarkerContainer}>
        <View style={[styles.driverMarkerDot, isAssigned && styles.driverMarkerAssigned]}>
          <Ionicons name="car-sport" size={16} color={colors.white} />
        </View>
      </View>
    </Marker>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.isAssigned === nextProps.isAssigned &&
    prevProps.coordinate.latitude === nextProps.coordinate.latitude &&
    prevProps.coordinate.longitude === nextProps.coordinate.longitude
  );
});

DriverMarker.displayName = 'DriverMarker';

const styles = StyleSheet.create({
  // Location Pins
  pinWrap: { alignItems: 'center' },
  pin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  pinStem: { width: 3, height: 10, marginTop: -1, borderRadius: 2 },
  markerLabel: {
    backgroundColor: colors.white,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 5,
    maxWidth: 170,
    boxShadow: elevationShadows.raised,
  },
  markerLabelText: {
    fontFamily: 'Inter_600SemiBold', // Matches fonts.semibold from theme
    fontSize: 12,
    color: colors.navy,
  },

  // Driver Marker
  driverMarkerContainer: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  driverMarkerDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.navy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 6,
    borderWidth: 2,
    borderColor: colors.white,
  },
  driverMarkerAssigned: {
    borderColor: colors.gold,
    borderWidth: 3,
    shadowColor: colors.gold,
    shadowOpacity: 0.8,
  },
});
