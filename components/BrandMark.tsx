import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

// ─────────────────────────────────────────────────────────────────────────────
// El glifo de marca: el compartimento del pastillero con su pastilla dentro —
// el mismo dibujo que assets/images/icon.png (ver "Ícono de marca" en
// DESIGN.md), pero hecho de Views nativas para poder tintarse por rol y vivir
// a cualquier tamaño dentro de la UI, en vez de depender de un PNG de 1024px
// fijo. Hoy solo lo usa el encabezado de Login; cualquier otro lugar que
// necesite "la marca, no un ícono de librería" debería usar este componente,
// no un Ionicons genérico.
// ─────────────────────────────────────────────────────────────────────────────

interface BrandMarkProps {
  /** Lado del glifo completo (el compartimento incluido su aire). */
  size?: number;
  /** Color del compartimento. Por defecto, `onPrimaryContainer` del esquema activo. */
  boxColor?: string;
  /** Color de la pastilla. Por defecto, `primary` del esquema activo. */
  pillColor?: string;
  style?: StyleProp<ViewStyle>;
}

export default function BrandMark({ size = 64, boxColor, pillColor, style }: BrandMarkProps) {
  const { scheme } = useTheme();
  const box = boxColor ?? scheme.onPrimaryContainer;
  const pill = pillColor ?? scheme.primary;

  const boxSize = size * 0.72;
  const boxOffset = (size - boxSize) / 2;
  const seamWidth = boxSize * 0.52;
  const pillSize = size * 0.3;
  const pillOffset = {
    left: size / 2 - pillSize / 2 + size * 0.045,
    top: size / 2 - pillSize / 2 + size * 0.08,
  };

  return (
    <View style={[{ width: size, height: size }, style]}>
      <View
        style={{
          position: 'absolute',
          left: boxOffset,
          top: boxOffset,
          width: boxSize,
          height: boxSize,
          borderRadius: boxSize * 0.28,
          backgroundColor: box,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: boxOffset + (boxSize - seamWidth) / 2,
          top: boxOffset + boxSize * 0.16,
          width: seamWidth,
          height: Math.max(2, size * 0.018),
          borderRadius: 999,
          backgroundColor: pill,
          opacity: 0.55,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: pillOffset.left,
          top: pillOffset.top,
          width: pillSize,
          height: pillSize,
          borderRadius: pillSize / 2,
          backgroundColor: pill,
        }}
      />
    </View>
  );
}
