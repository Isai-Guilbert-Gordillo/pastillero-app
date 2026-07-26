import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Text from '@/components/ui/Text';
import { useTheme } from '@/context/ThemeContext';
import { MOTION, SHAPE, SPACING, STATE_LAYER, TOUCH, withAlpha } from '@/lib/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Fila de lista de Material 3: leading / contenido / trailing.
//
// Sustituye al patrón anterior de "una tarjeta blanca por cada dato". Una lista
// de información es una lista; envolver cada renglón en su propia tarjeta con
// sombra hace que seis datos equivalentes se lean como seis decisiones.
// ─────────────────────────────────────────────────────────────────────────────

interface ListItemProps {
  headline: string;
  supporting?: string;
  overline?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onPress?: () => void;
  /** Muestra el chevron de "esto navega". Solo con onPress. */
  navigates?: boolean;
  /** Color del texto principal, para valores con estado (hora en ámbar, etc.). */
  headlineColor?: string;
  style?: StyleProp<ViewStyle>;
}

export default function ListItem({
  headline,
  supporting,
  overline,
  leading,
  trailing,
  onPress,
  navigates = false,
  headlineColor,
  style,
}: ListItemProps) {
  const { scheme } = useTheme();
  const press = useSharedValue(0);
  const layerStyle = useAnimatedStyle(() => ({ opacity: press.value }));

  const body = (
    <>
      {leading && <View style={styles.leading}>{leading}</View>}

      <View style={styles.content}>
        {!!overline && (
          <Text variant="labelSmall" tone="variant" numberOfLines={1}>
            {overline}
          </Text>
        )}
        <Text variant="titleSmall" color={headlineColor} numberOfLines={2}>
          {headline}
        </Text>
        {!!supporting && (
          <Text variant="bodySmall" tone="variant" style={styles.supporting}>
            {supporting}
          </Text>
        )}
      </View>

      {trailing}
      {navigates && !trailing && (
        <Ionicons name="chevron-forward" size={26} color={scheme.onSurfaceVariant} />
      )}
    </>
  );

  if (!onPress) {
    return <View style={[styles.row, style]}>{body}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={supporting ? `${headline}. ${supporting}` : headline}
      onPress={onPress}
      onPressIn={() => {
        press.value = withTiming(1, {
          duration: MOTION.duration.short,
          easing: Easing.bezier(...MOTION.easing.standard),
        });
      }}
      onPressOut={() => {
        press.value = withTiming(0, {
          duration: MOTION.duration.medium,
          easing: Easing.bezier(...MOTION.easing.standard),
        });
      }}
      style={[styles.row, styles.pressable, style]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: withAlpha(scheme.onSurface, STATE_LAYER.pressed), borderRadius: SHAPE.medium },
          layerStyle,
        ]}
      />
      {body}
    </Pressable>
  );
}

/** Separador entre filas. Decorativo: usa `outlineVariant`, sin requisito de contraste. */
export function ListDivider({ inset = true }: { inset?: boolean }) {
  const { scheme } = useTheme();
  return (
    <View
      style={{
        height: 1,
        backgroundColor: scheme.outlineVariant,
        marginLeft: inset ? SPACING.xxl + SPACING.xl : 0,
      }}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TOUCH.min,
    paddingVertical: SPACING.md,
    gap: SPACING.lg,
  },
  pressable: {
    borderRadius: SHAPE.medium,
    overflow: 'hidden',
    paddingHorizontal: SPACING.sm,
    marginHorizontal: -SPACING.sm,
  },
  leading: {
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  supporting: {
    marginTop: 2,
  },
});
