import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Text from '@/components/ui/Text';
import { useTheme } from '@/context/ThemeContext';
import { MOTION, SCREEN_MARGIN, SHAPE, SPACING, STATE_LAYER, TOUCH, elevation, withAlpha } from '@/lib/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Barra superior de Material 3.
//
// Reemplaza el encabezado de degradado teal con emoji que coronaba TODAS las
// pantallas de la versión anterior: cuando cada pantalla lleva el mismo bloque
// de color grande arriba, ninguna se distingue de las otras y el degradado se
// come el presupuesto de atención que necesitaba el contenido.
//
//   · `large`  — pantallas raíz. Título en Headline, dos líneas de alto.
//   · `small`  — pantallas apiladas, con flecha de retroceso.
//
// Gana elevación (level 2) solo cuando hay contenido desplazado por debajo, que
// es la única razón por la que Material eleva una barra: decir "hay más arriba".
// ─────────────────────────────────────────────────────────────────────────────

export interface AppBarAction {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}

interface TopAppBarProps {
  title: string;
  subtitle?: string;
  variant?: 'large' | 'small';
  onBack?: () => void;
  actions?: AppBarAction[];
  /** true cuando el contenido pasó por debajo: eleva y tiñe la barra. */
  scrolled?: boolean;
}

function IconButton({ action, color }: { action: AppBarAction; color: string }) {
  const press = useSharedValue(0);
  const layerStyle = useAnimatedStyle(() => ({ opacity: press.value }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={action.label}
      onPress={action.onPress}
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
      style={styles.iconButton}
      hitSlop={8}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: withAlpha(color, STATE_LAYER.pressed), borderRadius: SHAPE.full },
          layerStyle,
        ]}
      />
      <Ionicons name={action.icon} size={28} color={color} />
    </Pressable>
  );
}

export default function TopAppBar({
  title,
  subtitle,
  variant = 'large',
  onBack,
  actions = [],
  scrolled = false,
}: TopAppBarProps) {
  const { scheme } = useTheme();
  const insets = useSafeAreaInsets();

  const background = scrolled ? scheme.surfaceContainer : scheme.background;

  return (
    <View
      style={[
        styles.bar,
        {
          paddingTop: insets.top,
          backgroundColor: background,
        },
        scrolled && elevation(2, scheme),
      ]}
    >
      <View style={styles.row}>
        {onBack ? (
          <IconButton
            action={{ icon: 'arrow-back', label: 'Volver', onPress: onBack }}
            color={scheme.onSurface}
          />
        ) : (
          <View style={styles.spacer} />
        )}

        {variant === 'small' ? (
          <Text variant="titleLarge" numberOfLines={1} style={styles.smallTitle}>
            {title}
          </Text>
        ) : (
          <View style={styles.flex} />
        )}

        <View style={styles.actions}>
          {actions.map((action) => (
            <IconButton key={action.label} action={action} color={scheme.onSurfaceVariant} />
          ))}
        </View>
      </View>

      {variant === 'large' && (
        <View style={styles.largeTitleBlock}>
          <Text variant="headlineMedium" numberOfLines={2}>
            {title}
          </Text>
          {!!subtitle && (
            <Text variant="bodyMedium" tone="variant" numberOfLines={2} style={styles.subtitle}>
              {subtitle}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    zIndex: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TOUCH.min,
    paddingHorizontal: SPACING.sm,
  },
  flex: {
    flex: 1,
  },
  spacer: {
    width: SPACING.sm,
  },
  smallTitle: {
    flex: 1,
    marginLeft: SPACING.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  iconButton: {
    width: TOUCH.min,
    height: TOUCH.min,
    borderRadius: SHAPE.full,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  largeTitleBlock: {
    paddingHorizontal: SCREEN_MARGIN,
    paddingBottom: SPACING.lg,
    paddingTop: SPACING.xs,
  },
  subtitle: {
    marginTop: SPACING.xs,
  },
});
