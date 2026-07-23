import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { BORDER_RADIUS, COLORS, FONTS, SHADOWS, SPACING, TOUCH_TARGET } from '@/lib/theme';

interface ChipProps {
  label: string;
  subLabel?: string;
  emoji?: string;
  selected: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function Chip({ label, subLabel, emoji, selected, onPress, style, compact }: ChipProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withTiming(0.95, { duration: 100 });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 150 });
      }}
      style={[
        styles.chip,
        compact && styles.chipCompact,
        selected && styles.chipSelected,
        animatedStyle,
        style,
      ]}
    >
      {emoji && <Text style={styles.emoji}>{emoji}</Text>}
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
      {subLabel && (
        <Text style={[styles.subLabel, selected && styles.subLabelSelected]}>{subLabel}</Text>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md + 4,
    minHeight: TOUCH_TARGET.minHeight,
    minWidth: 72,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  chipCompact: {
    minHeight: TOUCH_TARGET.minHeight,
    paddingHorizontal: SPACING.md,
  },
  chipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  emoji: {
    fontSize: FONTS.sizeSmall,
    textAlign: 'center',
  },
  label: {
    fontSize: FONTS.sizeMedium,
    fontFamily: FONTS.family.semiBold,
    color: COLORS.textSecondary,
  },
  labelSelected: {
    color: COLORS.white,
    fontFamily: FONTS.family.bold,
  },
  subLabel: {
    fontSize: 14,
    fontFamily: FONTS.family.medium,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  subLabelSelected: {
    color: COLORS.white,
  },
});
