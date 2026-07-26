import React from 'react';
import { Text as RNText, StyleProp, TextProps as RNTextProps, TextStyle } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { ColorScheme, TYPE, TypeRole } from '@/lib/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Texto tipado por rol.
//
// Ningún componente de esta app escribe fontSize a mano. Se elige un rol de la
// escala (display / headline / title / body / label) y el sistema resuelve
// familia, tamaño, interlínea, tracking y el techo de escalado del sistema.
//
// La Regla de los 16: el rol más chico de la escala es 14sp y solo existe para
// etiquetas de navegación y leyendas. Nada de prosa baja de 16sp.
// La Regla del sp Con Techo: `maxFontSizeMultiplier` por rol, para que al 200%
// del ajuste de fuente del sistema una alarma no se rompa por desbordamiento.
// ─────────────────────────────────────────────────────────────────────────────

export type Tone =
  | 'default'      // onSurface — el texto normal
  | 'variant'      // onSurfaceVariant — texto secundario, 7.6:1
  | 'muted'        // onSurfaceMuted — solo placeholders y deshabilitado
  | 'primary'
  | 'onPrimary'
  | 'onPrimaryContainer'
  | 'secondary'
  | 'onSecondaryContainer'
  | 'tertiary'
  | 'onTertiaryContainer'
  | 'error'
  | 'onErrorContainer'
  | 'warning'
  | 'onWarningContainer'
  | 'success'
  | 'onSuccessContainer'
  | 'inverse';     // onInverseSurface — snackbars

const toneColor = (tone: Tone, t: ColorScheme): string => {
  switch (tone) {
    case 'variant': return t.onSurfaceVariant;
    case 'muted': return t.onSurfaceMuted;
    case 'primary': return t.primary;
    case 'onPrimary': return t.onPrimary;
    case 'onPrimaryContainer': return t.onPrimaryContainer;
    case 'secondary': return t.secondary;
    case 'onSecondaryContainer': return t.onSecondaryContainer;
    case 'tertiary': return t.tertiary;
    case 'onTertiaryContainer': return t.onTertiaryContainer;
    case 'error': return t.error;
    case 'onErrorContainer': return t.onErrorContainer;
    case 'warning': return t.warning;
    case 'onWarningContainer': return t.onWarningContainer;
    case 'success': return t.success;
    case 'onSuccessContainer': return t.onSuccessContainer;
    case 'inverse': return t.onInverseSurface;
    default: return t.onSurface;
  }
};

export interface TextProps extends Omit<RNTextProps, 'style'> {
  variant?: TypeRole;
  tone?: Tone;
  /** Escapatoria para colores que ya vienen resueltos (p. ej. sobre un campo de marca). */
  color?: string;
  center?: boolean;
  style?: StyleProp<TextStyle>;
  children?: React.ReactNode;
}

export default function Text({
  variant = 'bodyLarge',
  tone = 'default',
  color,
  center,
  style,
  children,
  ...rest
}: TextProps) {
  const { scheme } = useTheme();
  const spec = TYPE[variant];

  return (
    <RNText
      maxFontSizeMultiplier={spec.maxScale}
      {...rest}
      style={[
        {
          fontFamily: spec.fontFamily,
          fontSize: spec.fontSize,
          lineHeight: spec.lineHeight,
          letterSpacing: spec.letterSpacing,
          color: color ?? toneColor(tone, scheme),
        },
        center && { textAlign: 'center' },
        style,
      ]}
    >
      {children}
    </RNText>
  );
}
