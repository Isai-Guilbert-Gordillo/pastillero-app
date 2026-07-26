import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Text from '@/components/ui/Text';
import { useCaregiver } from '@/context/CaregiverContext';
import { useTheme } from '@/context/ThemeContext';
import { SCREEN_MARGIN, SHAPE, SPACING, STATE_LAYER, withAlpha } from '@/lib/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Aviso persistente de modo cuidador.
//
// Es la única condición en la que el usuario NO está viendo su propia cuenta, y
// por eso es la única franja de color plano que la app pinta de lado a lado. El
// rol es `secondaryContainer` (índigo): estrictamente informativo, nunca ámbar
// ni rojo — no es un error estar cuidando a alguien.
// ─────────────────────────────────────────────────────────────────────────────

export default function PatientBanner() {
  const { isViewingOther, activePatientLabel, switchToSelf } = useCaregiver();
  const { scheme } = useTheme();

  if (!isViewingOther) return null;

  return (
    <View
      accessibilityRole="alert"
      style={[styles.banner, { backgroundColor: scheme.secondaryContainer }]}
    >
      <Ionicons name="eye" size={24} color={scheme.onSecondaryContainer} />
      <Text variant="labelMedium" tone="onSecondaryContainer" style={styles.text} numberOfLines={2}>
        Viendo la cuenta de {activePatientLabel}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Volver a mi cuenta"
        onPress={switchToSelf}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: pressed
              ? withAlpha(scheme.onSecondaryContainer, STATE_LAYER.pressed)
              : 'transparent',
            borderColor: scheme.onSecondaryContainer,
          },
        ]}
      >
        <Text variant="labelSmall" tone="onSecondaryContainer">
          Volver a la mía
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SCREEN_MARGIN,
    paddingVertical: SPACING.md,
  },
  text: {
    flex: 1,
  },
  button: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    borderRadius: SHAPE.full,
    borderWidth: 1,
  },
});
