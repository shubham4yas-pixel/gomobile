import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, type, fonts } from '@/theme';
import { withAlpha } from '@/theme/colors';

interface Milestone {
  id: string;
  label: string;
  progressPercentage: number;
}

interface TripProgressIndicatorProps {
  progressPercentage: number; // 0 to 100
  etaMin?: number | null;
  milestones?: Milestone[];
  accent?: string;
}

export function TripProgressIndicator({
  progressPercentage,
  etaMin,
  milestones = [],
  accent = colors.primary,
}: TripProgressIndicatorProps) {
  // Ensure progress is bounded
  const clampedProgress = Math.max(0, Math.min(100, progressPercentage));

  return (
    <View style={styles.container}>
      {/* ETA & Label Row */}
      <View style={styles.headerRow}>
        <Text style={styles.etaText}>
          {etaMin !== undefined && etaMin !== null ? `${etaMin} min` : '--'}
        </Text>
        <Text style={styles.etaLabel}>to destination</Text>
      </View>

      {/* Progress Track */}
      <View style={styles.trackContainer}>
        {/* Background Track */}
        <View style={styles.trackBackground} />

        {/* Fill Track */}
        <View 
          style={[
            styles.trackFill, 
            { backgroundColor: accent, width: `${clampedProgress}%` }
          ]} 
        />

        {/* Start Dot */}
        <View style={[styles.node, styles.startNode, { backgroundColor: accent }]} />

        {/* Intermediate Milestones */}
        {milestones.map((m) => (
          <View 
            key={m.id} 
            style={[
              styles.node, 
              styles.milestoneNode, 
              { 
                left: `${m.progressPercentage}%`,
                backgroundColor: clampedProgress >= m.progressPercentage ? accent : colors.hairlineStrong,
                borderColor: colors.surface,
              }
            ]} 
          />
        ))}

        {/* End Dot */}
        <View 
          style={[
            styles.node, 
            styles.endNode, 
            { 
              backgroundColor: clampedProgress >= 100 ? accent : colors.surface,
              borderColor: clampedProgress >= 100 ? accent : colors.hairlineStrong,
            }
          ]} 
        />

        {/* Active Car Marker */}
        <View 
          style={[
            styles.carMarker, 
            { left: `${clampedProgress}%`, borderColor: accent }
          ]}
        >
          <View style={[styles.carMarkerInner, { backgroundColor: accent }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
    gap: 8,
  },
  etaText: {
    ...type.display,
    fontSize: 24,
    color: colors.textPrimary,
  },
  etaLabel: {
    ...type.body,
    color: colors.textSecondary,
  },
  trackContainer: {
    height: 16,
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  trackBackground: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: colors.hairlineStrong,
    borderRadius: radius.full,
  },
  trackFill: {
    position: 'absolute',
    left: 0,
    height: 4,
    borderRadius: radius.full,
  },
  node: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    top: 2,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  startNode: {
    left: -4,
  },
  endNode: {
    right: -4,
  },
  milestoneNode: {
    transform: [{ translateX: -6 }],
  },
  carMarker: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 3,
    top: -2,
    transform: [{ translateX: -10 }],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  carMarkerInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
