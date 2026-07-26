import React from 'react';
import { StyleProp, View, ViewProps, ViewStyle } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { ElevationLevel, SHAPE, SPACING, elevation } from '@/lib/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Superficie: el "compartimento" del pastillero.
//
// La separación entre capas la hace el TONO, no la sombra. Una superficie
// blanca sobre el suelo gris de la app ya está separada; la sombra solo lo
// confirma en lo que de verdad flota (FAB, hoja, diálogo, snackbar).
//
// La Regla de la Tarjeta que No Anida: una Surface con `tone="surface"` nunca
// contiene otra. Si un bloque interior necesita separarse, sube a
// `tone="container"` — cambia de tono, no de elevación.
// ─────────────────────────────────────────────────────────────────────────────

export type SurfaceTone = 'surface' | 'container' | 'variant' | 'transparent';

export interface SurfaceProps extends ViewProps {
  tone?: SurfaceTone;
  level?: ElevationLevel;
  shape?: keyof typeof SHAPE;
  /** Padding interior estándar de tarjeta (16dp). */
  padded?: boolean;
  /** Borde de 1dp. Solo para marcar estado, nunca como recurso de jerarquía. */
  borderColor?: string;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export default function Surface({
  tone = 'surface',
  level = 0,
  shape = 'large',
  padded = false,
  borderColor,
  style,
  children,
  ...rest
}: SurfaceProps) {
  const { scheme } = useTheme();

  const background =
    tone === 'surface' ? scheme.surface
    : tone === 'container' ? scheme.surfaceContainer
    : tone === 'variant' ? scheme.surfaceVariant
    : 'transparent';

  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: background,
          borderRadius: SHAPE[shape],
        },
        padded && { padding: SPACING.lg },
        borderColor ? { borderWidth: 1, borderColor } : null,
        elevation(level, scheme),
        style,
      ]}
    >
      {children}
    </View>
  );
}
