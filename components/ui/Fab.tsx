import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Text from '@/components/ui/Text';
import { useTheme } from '@/context/ThemeContext';
import { MOTION, SHAPE, SPACING, STATE_LAYER, TOUCH, elevation, withAlpha } from '@/lib/theme';

// ─────────────────────────────────────────────────────────────────────────────
// FAB extendido con el comportamiento de scroll de Material 3.
//
// Un FAB fijo y siempre extendido es un rectángulo opaco de ~180dp posado sobre
// la lista: mientras uno se desplaza acaba tapando justo lo que iba a tocar.
// Material resuelve esto haciendo que el FAB REACCIONE al scroll:
//
//   · Arriba del todo, o desplazándose hacia arriba → extendido, con rótulo.
//     Es cuando la persona está decidiendo qué hacer, y ahí el rótulo importa.
//   · Desplazándose hacia abajo → se contrae a un círculo de 72dp. La huella
//     cae a un tercio y se queda en la esquina, fuera del camino de lectura.
//
// El rótulo no se recorta con `overflow` a ciegas: se mide una vez en su
// tamaño real (`onLayout`) y la animación interpola hasta ese ancho, así que
// sigue funcionando con el tamaño de fuente del sistema al máximo.
// ─────────────────────────────────────────────────────────────────────────────

interface FabProps {
  label: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  /** false lo contrae a círculo. Lo controla la pantalla según el scroll. */
  extended?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

export default function Fab({ label, icon = 'add', extended = true, onPress, style }: FabProps) {
  const { scheme } = useTheme();
  const [labelWidth, setLabelWidth] = useState(0);

  const press = useSharedValue(0);
  const layerStyle = useAnimatedStyle(() => ({ opacity: press.value }));
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 - press.value * 0.04 }] }));

  // Un solo valor gobierna la transición: 0 = círculo, 1 = extendido.
  const progress = useDerivedValue(() =>
    withTiming(extended && labelWidth > 0 ? 1 : 0, {
      duration: MOTION.duration.long,
      easing: Easing.bezier(...MOTION.easing.emphasized),
    })
  );

  const labelWrapStyle = useAnimatedStyle(() => ({
    width: labelWidth * progress.value,
    marginLeft: SPACING.md * progress.value,
    opacity: progress.value,
  }));

  return (
    <Animated.View style={[styles.wrap, scaleStyle, elevation(3, scheme), style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
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
        style={[styles.fab, { backgroundColor: scheme.primaryContainer }]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: withAlpha(scheme.onPrimaryContainer, STATE_LAYER.pressed),
              borderRadius: SHAPE.large,
            },
            layerStyle,
          ]}
        />

        <Ionicons name={icon} size={32} color={scheme.onPrimaryContainer} />

        <Animated.View style={[styles.labelWrap, labelWrapStyle]}>
          <Text variant="labelLarge" tone="onPrimaryContainer" numberOfLines={1}>
            {label}
          </Text>
        </Animated.View>
      </Pressable>

      {/* Medidor invisible: da el ancho real del rótulo con la fuente y el
          tamaño de sistema vigentes, sin ocupar espacio ni ser accesible. */}
      <View style={styles.measure} pointerEvents="none" accessibilityElementsHidden>
        <Text
          variant="labelLarge"
          numberOfLines={1}
          onLayout={(e) => {
            const w = Math.ceil(e.nativeEvent.layout.width);
            if (w > 0 && w !== labelWidth) setLabelWidth(w);
          }}
        >
          {label}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: SHAPE.large,
    alignSelf: 'flex-end',
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: TOUCH.primary,
    minWidth: TOUCH.primary,
    paddingHorizontal: SPACING.xl,
    borderRadius: SHAPE.large,
    overflow: 'hidden',
  },
  labelWrap: {
    overflow: 'hidden',
    justifyContent: 'center',
  },
  measure: {
    position: 'absolute',
    opacity: 0,
    left: 0,
    top: 0,
  },
});
