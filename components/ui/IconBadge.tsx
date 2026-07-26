import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { SHAPE } from '@/lib/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Ícono dentro de un contenedor tonal. El par (color de contenido, color de
// contenedor) SIEMPRE viene de un par de roles del esquema —`tertiary` /
// `tertiaryContainer`, `warning` / `warningContainer`— nunca de dos colores
// elegidos por separado, porque así resuelve solo en modo oscuro.
// ─────────────────────────────────────────────────────────────────────────────

interface IconBadgeProps {
  name: React.ComponentProps<typeof Ionicons>['name'];
  /** Color de contenido. Rol `on…` o el rol base del esquema activo. */
  color: string;
  /** Color de contenedor. El rol `…Container` que hace par con `color`. */
  backgroundColor: string;
  size?: number;
  iconSize?: number;
  /** Cuadrado de esquina generosa en vez de círculo. Para objetos, no personas. */
  square?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function IconBadge({
  name,
  color,
  backgroundColor,
  size = 48,
  iconSize,
  square = false,
  style,
}: IconBadgeProps) {
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width: size,
          height: size,
          borderRadius: square ? SHAPE.medium : SHAPE.full,
          backgroundColor,
          justifyContent: 'center',
          alignItems: 'center',
        },
        style,
      ]}
    >
      <Ionicons name={name} size={iconSize ?? Math.round(size * 0.5)} color={color} />
    </View>
  );
}
