import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import Animated, { FadeIn, Layout } from 'react-native-reanimated';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { StarRating } from './StarRating';
import { FeedbackChip } from './FeedbackChip';
import { DRIVER_FEEDBACK_CHIPS, RatingPayload } from '@/services/ratingService';
import { colors, fonts, radius } from '@/theme/theme';

interface DriverRatingCardProps {
  tripId: string;
  riderName: string;
  onSubmit: (payload: RatingPayload) => void;
}

export function DriverRatingCard({ tripId, riderName, onSubmit }: DriverRatingCardProps) {
  const [rating, setRating] = useState(5);
  const [selectedChips, setSelectedChips] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [isCommentExpanded, setIsCommentExpanded] = useState(false);

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
              <Ionicons name="person-outline" size={38} color={colors.driver} />
            </View>
            <Text style={styles.title}>Rate your passenger</Text>
            <Text style={styles.riderName}>{riderName}</Text>
          </View>

          <View style={styles.ratingWrap}>
            <StarRating value={rating} onChange={setRating} size={48} color={colors.driver} />
          </View>
          
          <Text style={styles.sectionTitle}>How was {riderName}?</Text>
          <View style={styles.chipsWrap}>
            {DRIVER_FEEDBACK_CHIPS.map(chip => (
              <FeedbackChip
                key={chip}
                label={chip}
                selected={selectedChips.includes(chip)}
                onPress={() => toggleChip(chip)}
              />
            ))}
          </View>

          <Animated.View layout={Layout.springify()} style={styles.commentSection}>
            {!isCommentExpanded ? (
              <Pressable 
                style={styles.addCommentBtn}
                onPress={() => setIsCommentExpanded(true)}
                accessibilityLabel="Add written feedback"
                accessibilityRole="button"
              >
                <Ionicons name="add" size={18} color={colors.driver} />
                <Text style={styles.addCommentText}>Add written feedback</Text>
              </Pressable>
            ) : (
              <TextInput
                style={styles.commentInput}
                placeholder="Tell us more about this passenger..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
                value={comment}
                onChangeText={setComment}
                autoFocus
                returnKeyType="done"
                accessibilityLabel="Additional feedback comment"
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
  title: {
    ...fonts.heading3,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  riderName: {
    ...fonts.heading2,
    color: colors.textPrimary,
    textAlign: 'center',
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
    marginBottom: 24,
  },
  addCommentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 44,
    paddingVertical: 12,
  },
  addCommentText: {
    ...fonts.bodyMedium,
    color: colors.driver,
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
