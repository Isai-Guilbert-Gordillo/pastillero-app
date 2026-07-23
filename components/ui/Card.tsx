import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { BORDER_RADIUS, COLORS, SHADOWS, SPACING } from '@/lib/theme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}

export default function Card({ children, style, padded = true }: CardProps) {
  return <View style={[styles.card, padded && styles.padded, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    ...SHADOWS.card,
  },
  padded: {
    padding: SPACING.lg,
  },
});
