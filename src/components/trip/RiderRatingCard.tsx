import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import Animated, { FadeIn, Layout } from 'react-native-reanimated';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { StarRating } from './StarRating';
import { FeedbackChip } from './FeedbackChip';
import { TipSelector } from './TipSelector';
import { RIDER_FEEDBACK_CHIPS, RatingPayload } from '@/services/ratingService';
import { colors, fonts, radius } from '@/theme/theme';
import type { DriverProfile } from '@/lib/driverProfile';

interface RiderRatingCardProps {
  tripId: string;
  driver: DriverProfile | null;
  onSubmit: (payload: RatingPayload) => void;
}

export function RiderRatingCard({ tripId, driver, onSubmit }: RiderRatingCardProps) {
  const [rating, setRating] = useState(5);
  const [selectedChips, setSelectedChips] = useState<string[]>([]);
  const [tipAmount, setTipAmount] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [isCommentExpanded, setIsCommentExpanded] = useState(false);

  // Auto-expand comment field if rating <= 3
  useEffect(() => {
    if (rating <= 3 && !isCommentExpanded) {
      setIsCommentExpanded(true);
    }
  }, [rating, isCommentExpanded]);

  const toggleChip = (chip: string) => {
    setSelectedChips(prev => 
      prev.includes(chip) ? prev.filter(c => c !== chip) : [...prev, chip]
    );
  };

  const handleSubmit = () => {
    onSubmit({
      tripId,
      rating,
      chips: selectedChips,
      comment: comment.trim() || undefined,
      tipAmount: tipAmount || undefined,
    });
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <BottomSheetScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        
        <Animated.View entering={FadeIn.duration(400)} layout={Layout.springify()}>
          <View style={styles.header}>
            <View style={styles.avatar}>
              <Ionicons name="person-outline" size={38} color={colors.rider} />
            </View>
            <Text style={styles.driverName}>How was your ride with {driver?.name || 'your driver'}?</Text>
            <Text style={styles.vehicleInfo}>
              {driver?.car || 'Vehicle'} • {driver?.plate || 'Plate'}
            </Text>
          </View>

          <View style={styles.ratingWrap}>
            <StarRating value={rating} onChange={setRating} size={48} />
          </View>
          
          <Text style={styles.sectionTitle}>What went well?</Text>
          <View style={styles.chipsWrap}>
            {RIDER_FEEDBACK_CHIPS.map(chip => (
              <FeedbackChip
                key={chip}
                label={chip}
                selected={selectedChips.includes(chip)}
                onPress={() => toggleChip(chip)}
              />
            ))}
          </View>

          <Text style={styles.sectionTitle}>Add a tip for {driver?.name || 'your driver'}</Text>
          <TipSelector selectedTip={tipAmount} onSelect={setTipAmount} />

          <Animated.View layout={Layout.springify()} style={styles.commentSection}>
            {!isCommentExpanded ? (
              <Text 
                style={styles.addCommentText} 
                onPress={() => setIsCommentExpanded(true)}
              >
                + Add written feedback
              </Text>
            ) : (
              <TextInput
                style={styles.commentInput}
                placeholder="Tell us more about your ride..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
                value={comment}
                onChangeText={setComment}
                autoFocus
                returnKeyType="done"
              />
            )}
          </Animated.View>

          <View style={styles.footer}>
            <PrimaryButton label="Submit Feedback" onPress={handleSubmit} />
          </View>
        </Animated.View>
      </BottomSheetScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1 },
  contentContainer: { padding: 24, paddingBottom: 40 },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  driverName: {
    ...fonts.heading2,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  vehicleInfo: {
    ...fonts.bodyMedium,
    color: colors.textSecondary,
  },
  ratingWrap: {
    alignItems: 'center',
    marginBottom: 32,
  },
  sectionTitle: {
    ...fonts.heading3,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 24,
  },
  commentSection: {
    marginTop: 24,
    marginBottom: 24,
  },
  addCommentText: {
    ...fonts.bodyMedium,
    color: colors.rider,
    paddingVertical: 8,
  },
  commentInput: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: 16,
    minHeight: 80,
    ...fonts.bodyRegular,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.hairline,
    textAlignVertical: 'top',
  },
  footer: {
    marginTop: 16,
  },
});
