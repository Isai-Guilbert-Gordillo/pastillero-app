import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { BORDER_RADIUS, COLORS, FONTS, SHADOWS, SPACING, TOUCH_TARGET } from '@/lib/theme';

type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  style,
}: ButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const isDisabled = disabled || loading;

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={isDisabled}
      onPressIn={() => {
        scale.value = withTiming(0.96, { duration: 100 });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 150 });
      }}
      style={[
        styles.base,
        variantStyles[variant].container,
        isDisabled && styles.disabled,
        animatedStyle,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variantStyles[variant].text.color as string} size="large" />
      ) : (
        <>
          {icon && (
            <Ionicons
              name={icon}
              size={26}
              color={variantStyles[variant].text.color as string}
              style={styles.icon}
            />
          )}
          <Text style={[styles.text, variantStyles[variant].text]}>{title}</Text>
        </>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: TOUCH_TARGET.minHeight,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.lg,
  },
  disabled: {
    opacity: 0.6,
  },
  icon: {
    marginRight: SPACING.sm,
  },
  text: {
    fontSize: FONTS.sizeLarge,
    fontFamily: FONTS.family.bold,
  },
});

const variantStyles: Record<ButtonVariant, { container: ViewStyle; text: { color: string } }> = {
  primary: {
    container: { backgroundColor: COLORS.primary, ...SHADOWS.button },
    text: { color: COLORS.white },
  },
  secondary: {
    container: { backgroundColor: COLORS.secondaryLight },
    text: { color: COLORS.secondary },
  },
  destructive: {
    container: { backgroundColor: COLORS.dangerLight },
    text: { color: COLORS.danger },
  },
  ghost: {
    container: { backgroundColor: COLORS.inputBg },
    text: { color: COLORS.textSecondary },
  },
};
