import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Text from '@/components/ui/Text';
import { useTheme } from '@/context/ThemeContext';
import { MOTION, SHAPE, SPACING, STATE_LAYER, TOUCH, withAlpha } from '@/lib/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Chip de filtro de Material 3.
//
// La selección se comunica con FORMA y color a la vez: aparece una palomita a
// la izquierda, no solo cambia el fondo. Cataratas y daltonismo son parte del
// público de esta app; un chip que solo cambia de color no dice nada.
//
// Altura 56dp — por encima de los 32dp de Material, por el compromiso de
// precisión motora de PRODUCT.md.
// ─────────────────────────────────────────────────────────────────────────────

interface ChipProps {
  label: string;
  /** Segunda línea, más chica. Ej. el nombre completo del día bajo la inicial. */
  subLabel?: string;
  /** Ícono decorativo a la izquierda cuando NO está seleccionado (ej. un emoji de horario). */
  leading?: React.ReactNode;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function Chip({
  label,
  subLabel,
  leading,
  selected,
  onPress,
  disabled,
  style,
}: ChipProps) {
  const { scheme } = useTheme();

  const press = useSharedValue(0);
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 - press.value * 0.03 }] }));
  const layerStyle = useAnimatedStyle(() => ({ opacity: press.value }));

  const content = selected ? scheme.onPrimaryContainer : scheme.onSurfaceVariant;

  return (
    <Animated.View style={[scaleStyle, style]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected, disabled }}
        accessibilityLabel={subLabel ? `${label}, ${subLabel}` : label}
        onPress={onPress}
        disabled={disabled}
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
        style={[
          styles.chip,
          {
            backgroundColor: selected ? scheme.primaryContainer : 'transparent',
            borderColor: selected ? 'transparent' : scheme.outline,
            borderWidth: selected ? 0 : 1,
          },
          disabled && { opacity: STATE_LAYER.disabled },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: withAlpha(content, STATE_LAYER.pressed), borderRadius: SHAPE.small },
            layerStyle,
          ]}
        />

        {selected ? (
          <Animated.View entering={FadeIn.duration(MOTION.duration.short)} exiting={FadeOut.duration(100)}>
            <Ionicons name="checkmark" size={22} color={content} style={styles.check} />
          </Animated.View>
        ) : (
          leading
        )}

        <View style={styles.labels}>
          <Text variant="labelLarge" color={content} numberOfLines={1}>
            {label}
          </Text>
          {!!subLabel && (
            <Text variant="labelSmall" color={content} numberOfLines={1} style={styles.subLabel}>
              {subLabel}
            </Text>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    minWidth: TOUCH.min,
    paddingHorizontal: SPACING.lg,
    borderRadius: SHAPE.small,
    overflow: 'hidden',
  },
  check: {
    marginRight: SPACING.sm,
  },
  labels: {
    alignItems: 'center',
  },
  subLabel: {
    marginTop: 1,
    opacity: 0.9,
  },
});
