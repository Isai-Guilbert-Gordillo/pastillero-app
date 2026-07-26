import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Text from '@/components/ui/Text';
import { useTheme } from '@/context/ThemeContext';
import {
  ColorScheme,
  MOTION,
  SHAPE,
  SPACING,
  STATE_LAYER,
  TOUCH,
  elevation,
  withAlpha,
} from '@/lib/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Botón — familia completa de Material 3.
//
// La Regla del Botón Cápsula: todo botón de acción es `full`. Es la forma que
// Material usa para "esto se toca" y a 80 años se reconoce antes de leerse.
//
// Un solo `filled` por pantalla. Dos acciones principales compiten y en esta app
// la competencia se paga con una dosis mal registrada.
//
// El estado presionado es una capa de estado (12% del color de contenido sobre
// el fondo) más una compresión de escala — el color base NUNCA cambia, que es lo
// que hace que un botón se sienta del mismo objeto antes y durante el toque.
// ─────────────────────────────────────────────────────────────────────────────

export type ButtonVariant =
  | 'filled'      // acción principal
  | 'tonal'       // alternativa real, mismo peso semántico, misma familia de color
  | 'info'        // acción del modo cuidador — el único índigo con forma de botón
  | 'outlined'    // acción de bajo compromiso
  | 'text'        // dentro de diálogos y snackbars
  | 'destructive' // eliminar, cerrar sesión
  | 'warning';    // acción sobre un pendiente del sistema

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  /** Coloca el ícono a la derecha (p. ej. "Abrir ajustes ↗"). */
  iconTrailing?: boolean;
  loading?: boolean;
  disabled?: boolean;
  /** Acción principal de la pantalla: 72dp en vez de 64dp. */
  emphasis?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

interface VariantSpec {
  container: string;
  content: string;
  border?: string;
  level: 0 | 1;
}

const specFor = (variant: ButtonVariant, t: ColorScheme): VariantSpec => {
  switch (variant) {
    case 'filled':
      return { container: t.primary, content: t.onPrimary, level: 0 };
    // El botón tonal es el hermano de baja emfasis del `filled`, así que comparte
    // su FAMILIA de color. Antes usaba `secondaryContainer` —que en este sistema
    // es índigo, un tono distinto reservado al modo cuidador— y el resultado era
    // un botón morado gritando junto a uno teal, como si fueran dos productos.
    case 'tonal':
      return { container: t.primaryContainer, content: t.onPrimaryContainer, level: 0 };
    case 'info':
      return { container: t.secondaryContainer, content: t.onSecondaryContainer, level: 0 };
    case 'outlined':
      return { container: 'transparent', content: t.primary, border: t.outline, level: 0 };
    case 'text':
      return { container: 'transparent', content: t.primary, level: 0 };
    case 'destructive':
      return { container: t.errorContainer, content: t.onErrorContainer, level: 0 };
    case 'warning':
      return { container: t.warningContainer, content: t.onWarningContainer, level: 0 };
  }
};

export default function Button({
  title,
  onPress,
  variant = 'filled',
  icon,
  iconTrailing = false,
  loading = false,
  disabled = false,
  emphasis = false,
  fullWidth = true,
  style,
  accessibilityHint,
}: ButtonProps) {
  const { scheme } = useTheme();
  const spec = specFor(variant, scheme);
  const isDisabled = disabled || loading;

  const press = useSharedValue(0);
  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.03 }],
  }));
  const layerStyle = useAnimatedStyle(() => ({ opacity: press.value }));

  const height = variant === 'text' ? 48 : emphasis ? TOUCH.primary : TOUCH.min;

  const iconNode = icon ? (
    <Ionicons
      name={icon}
      size={26}
      color={spec.content}
      style={iconTrailing ? styles.iconTrailing : styles.iconLeading}
    />
  ) : null;

  return (
    <Animated.View style={[fullWidth && styles.fullWidth, containerStyle, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        onPress={onPress}
        disabled={isDisabled}
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
          styles.base,
          {
            minHeight: height,
            backgroundColor: isDisabled && variant !== 'outlined' && variant !== 'text'
              ? withAlpha(scheme.onSurface, STATE_LAYER.disabledContainer)
              : spec.container,
            borderRadius: SHAPE.full,
            paddingHorizontal: variant === 'text' ? SPACING.lg : SPACING.xl,
          },
          spec.border ? { borderWidth: 1, borderColor: isDisabled ? scheme.outlineVariant : spec.border } : null,
          elevation(spec.level, scheme),
        ]}
      >
        {/* Capa de estado: el color de contenido al 12% sobre el fondo. */}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: withAlpha(spec.content, STATE_LAYER.pressed),
              borderRadius: SHAPE.full,
            },
            layerStyle,
          ]}
        />

        {loading ? (
          <ActivityIndicator color={spec.content} size="small" />
        ) : (
          <View style={styles.row}>
            {!iconTrailing && iconNode}
            <Text
              variant="labelLarge"
              color={isDisabled ? withAlpha(scheme.onSurface, STATE_LAYER.disabled) : spec.content}
              numberOfLines={2}
              style={styles.label}
            >
              {title}
            </Text>
            {iconTrailing && iconNode}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fullWidth: {
    width: '100%',
  },
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flexShrink: 1,
    textAlign: 'center',
  },
  iconLeading: {
    marginRight: SPACING.sm,
  },
  iconTrailing: {
    marginLeft: SPACING.sm,
  },
});
