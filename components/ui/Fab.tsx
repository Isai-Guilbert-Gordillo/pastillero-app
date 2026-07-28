import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Text from '@/components/ui/Text';
import { useTheme } from '@/context/ThemeContext';
import { MOTION, SHAPE, SPACING, STATE_LAYER, TOUCH, elevation, withAlpha } from '@/lib/theme';

// ─────────────────────────────────────────────────────────────────────────────
// FAB extendido con el comportamiento de scroll de Material 3.
//
// Un FAB fijo y siempre extendido es un rectángulo opaco de ~200dp posado sobre
// la lista: mientras uno se desplaza acaba tapando justo lo que iba a tocar.
// Material resuelve esto haciendo que el FAB REACCIONE al scroll:
//
//   · Arriba del todo, o desplazándose hacia arriba → extendido, con rótulo.
//     Es cuando la persona está decidiendo qué hacer, y ahí el rótulo importa.
//   · Desplazándose hacia abajo → se contrae a un círculo de 72dp. La huella
//     cae a un tercio y se queda en la esquina, fuera del camino de lectura.
//
// El rótulo se monta y desmonta, y el ancho lo resuelve el propio layout con
// `LinearTransition`. La versión anterior medía el rótulo con `onLayout` y
// animaba el ancho a mano: el problema es que esa medida llegaba ANTES de que
// Reanimated registrara el worklet que la escuchaba, así que el valor se perdía
// y el rótulo se quedaba plegado en 0 para siempre. Sin medición no hay orden
// que respetar y el componente no puede quedarse a medias.
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

  const press = useSharedValue(0);
  const layerStyle = useAnimatedStyle(() => ({ opacity: press.value }));
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 - press.value * 0.04 }] }));

  return (
    // El contenedor lleva el color de fondo, no solo el Pressable: en Android la
    // sombra de `elevation` se dibuja a partir del fondo de la vista elevada, y
    // con fondo transparente no se dibuja nada. Un FAB sin sombra y translúcido
    // deja ver el contenido por debajo y se lee como empalmado con la lista, que
    // es exactamente lo que un botón flotante no debe parecer.
    <Animated.View
      layout={LinearTransition.duration(MOTION.duration.long).easing(
        Easing.bezier(...MOTION.easing.emphasized).factory()
      )}
      style={[
        styles.wrap,
        { backgroundColor: scheme.primaryContainer },
        scaleStyle,
        elevation(3, scheme),
        style,
      ]}
    >
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

        {extended && (
          <Animated.View
            entering={FadeIn.duration(MOTION.duration.medium)}
            exiting={FadeOut.duration(MOTION.duration.short)}
            style={styles.labelWrap}
          >
            <Text variant="labelLarge" tone="onPrimaryContainer" numberOfLines={1}>
              {label}
            </Text>
          </Animated.View>
        )}
      </Pressable>
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
    marginLeft: SPACING.md,
  },
});
