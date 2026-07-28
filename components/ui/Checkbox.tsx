import Text from '@/components/ui/Text';
import { useTheme } from '@/context/ThemeContext';
import { MOTION, SHAPE, SPACING, STATE_LAYER, TOUCH, withAlpha } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

// ─────────────────────────────────────────────────────────────────────────────
// Casilla de verificación.
//
// La caja mide 32dp —el doble que los 18dp de Material— y el área tocable es
// toda la fila, etiqueta incluida: acertarle a un cuadrito de 18dp con dedos de
// 80 años y temblor no es razonable.
//
// Marcada, cambia FORMA (aparece la palomita) además de color, por la misma
// razón que el Chip: cataratas y daltonismo están en el público de esta app.
//
// El error se muestra debajo y además tiñe el borde de la caja: el mensaje
// solo no basta si la persona no está mirando ahí.
// ─────────────────────────────────────────────────────────────────────────────

interface CheckboxProps {
  checked: boolean;
  onToggle: () => void;
  /** Texto de la casilla. Puede ser un nodo para incluir enlaces. */
  label: React.ReactNode;
  /** Etiqueta plana para lectores de pantalla, si `label` es un nodo. */
  accessibilityLabel?: string;
  error?: string | null;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function Checkbox({
  checked,
  onToggle,
  label,
  accessibilityLabel,
  error,
  disabled,
  style,
}: CheckboxProps) {
  const { scheme } = useTheme();

  const boxBorder = error ? scheme.error : checked ? scheme.primary : scheme.outline;

  return (
    <View style={style}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked, disabled }}
        accessibilityLabel={accessibilityLabel}
        onPress={onToggle}
        disabled={disabled}
        style={({ pressed }) => [
          styles.row,
          pressed && { backgroundColor: withAlpha(scheme.onSurface, STATE_LAYER.pressed) },
          disabled && { opacity: STATE_LAYER.disabled },
        ]}
      >
        <View
          style={[
            styles.box,
            {
              borderColor: boxBorder,
              backgroundColor: checked ? scheme.primary : 'transparent',
            },
          ]}
        >
          {checked && (
            <Animated.View entering={FadeIn.duration(MOTION.duration.short)} exiting={FadeOut.duration(100)}>
              <Ionicons name="checkmark" size={24} color={scheme.onPrimary} />
            </Animated.View>
          )}
        </View>

        <View style={styles.labelWrap}>
          {typeof label === 'string' ? <Text variant="bodyMedium">{label}</Text> : label}
        </View>
      </Pressable>

      {!!error && (
        <Text variant="bodySmall" tone="error" style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    minHeight: TOUCH.min,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    borderRadius: SHAPE.small,
  },
  box: {
    width: 32,
    height: 32,
    borderRadius: SHAPE.extraSmall,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    // Alinea la caja con la primera línea del texto, no con el bloque entero.
    marginTop: 2,
  },
  labelWrap: {
    flex: 1,
  },
  error: {
    marginTop: SPACING.xs,
    marginLeft: SPACING.xs,
  },
});
