import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import Text from '@/components/ui/Text';
import { useTheme } from '@/context/ThemeContext';
import { ColorScheme, SHAPE, SPACING } from '@/lib/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Estado de una dosis — el semáforo del producto.
//
// La Regla del Semáforo Honesto: verde, ámbar y rojo SOLO describen el estado de
// una dosis. Nunca decoran.
//
// Cada estado se comunica con FORMA y color a la vez. Un usuario con cataratas o
// daltonismo debe poder distinguir "tomada" de "no tomada" sin percibir el tono:
// palomita, reloj, equis y círculo vacío son cuatro siluetas distintas.
// ─────────────────────────────────────────────────────────────────────────────

export type DoseState = 'taken' | 'pending' | 'missed' | 'future';

interface StateSpec {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  content: (t: ColorScheme) => string;
  container: (t: ColorScheme) => string;
  label: string;
}

const SPECS: Record<DoseState, StateSpec> = {
  taken: {
    icon: 'checkmark',
    content: (t) => t.onSuccessContainer,
    container: (t) => t.successContainer,
    label: 'Tomada',
  },
  pending: {
    icon: 'time',
    content: (t) => t.onWarningContainer,
    container: (t) => t.warningContainer,
    label: 'Pendiente',
  },
  missed: {
    icon: 'close',
    content: (t) => t.onErrorContainer,
    container: (t) => t.errorContainer,
    label: 'No tomada',
  },
  future: {
    icon: 'ellipse-outline',
    content: (t) => t.onSurfaceVariant,
    container: (t) => t.surfaceVariant,
    label: 'Aún no llega',
  },
};

interface DoseStatusProps {
  state: DoseState;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export default function DoseStatus({ state, size = 40, style }: DoseStatusProps) {
  const { scheme } = useTheme();
  const spec = SPECS[state];

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={spec.label}
      style={[
        {
          width: size,
          height: size,
          borderRadius: SHAPE.full,
          backgroundColor: spec.container(scheme),
          justifyContent: 'center',
          alignItems: 'center',
        },
        style,
      ]}
    >
      <Ionicons name={spec.icon} size={Math.round(size * 0.6)} color={spec.content(scheme)} />
    </View>
  );
}

/** Entrada de leyenda: la misma silueta que en la cuadrícula, más su nombre. */
export function DoseStatusLegend({ state }: { state: DoseState }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
      <DoseStatus state={state} size={28} />
      <Text variant="labelSmall" tone="variant">
        {SPECS[state].label}
      </Text>
    </View>
  );
}

export const doseStateLabel = (state: DoseState) => SPECS[state].label;
