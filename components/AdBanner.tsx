import React from 'react';
import { StyleSheet, View } from 'react-native';
import Text from '@/components/ui/Text';
import { useTheme } from '@/context/ThemeContext';
import { SCREEN_MARGIN, SHAPE, SPACING } from '@/lib/theme';

// Marcador de posición compatible con Expo Go — todavía no hay AdMob real.
// Para producción: instalar react-native-google-mobile-ads, agregar el plugin en
// app.json y hacer un build nativo con EAS.
//
// Se mantiene deliberadamente apagado (superficie variante, borde punteado, sin
// color de marca) y lejos del botón de confirmar dosis: un toque accidental en
// plena alarma no puede sacar a la persona de la app.

export function AdBanner() {
  const { scheme } = useTheme();

  return (
    <View
      accessibilityLabel="Espacio publicitario"
      style={[
        styles.placeholder,
        { borderColor: scheme.outlineVariant, backgroundColor: scheme.surfaceContainer },
      ]}
    >
      <Text variant="labelSmall" tone="muted">
        Espacio publicitario
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: SCREEN_MARGIN,
    marginTop: SPACING.xxl,
    borderRadius: SHAPE.medium,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
});
