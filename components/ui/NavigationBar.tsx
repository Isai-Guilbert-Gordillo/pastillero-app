import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Text from '@/components/ui/Text';
import { useTheme } from '@/context/ThemeContext';
import { MOTION, NAV_BAR_HEIGHT, SHAPE, SPACING, TOUCH } from '@/lib/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Barra de navegación de Material 3.
//
// Tres destinos, no cuatro. "Agregar" salió de aquí: era una TAREA disfrazada de
// LUGAR. Material reserva la barra inferior para destinos —sitios a los que se
// vuelve— y la acción principal para el FAB. El formulario de alta ahora se abre
// como pantalla completa desde el FAB de Inicio, que además le da a la acción
// más importante de la app un rótulo que se lee ("Agregar medicamento") en vez
// de un "+" de 26px en una esquina.
//
// El indicador activo es la píldora de 64×40dp de Material: la forma, no solo el
// color, dice dónde estás.
// ─────────────────────────────────────────────────────────────────────────────

const ICONS: Record<string, { active: React.ComponentProps<typeof Ionicons>['name']; inactive: React.ComponentProps<typeof Ionicons>['name'] }> = {
  index: { active: 'home', inactive: 'home-outline' },
  history: { active: 'calendar', inactive: 'calendar-outline' },
  profile: { active: 'person', inactive: 'person-outline' },
};

function NavItem({
  focused,
  routeName,
  label,
  onPress,
  onLongPress,
}: {
  focused: boolean;
  routeName: string;
  label: string;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const { scheme } = useTheme();
  const icons = ICONS[routeName] ?? { active: 'ellipse', inactive: 'ellipse-outline' };

  const progress = useDerivedValue(() =>
    withTiming(focused ? 1 : 0, {
      duration: MOTION.duration.medium,
      easing: Easing.bezier(...MOTION.easing.emphasized),
    })
  );

  // El indicador crece desde el centro en el eje X — el movimiento de "shared
  // axis" que Material usa entre destinos hermanos.
  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scaleX: 0.4 + progress.value * 0.6 }],
  }));

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.item}
    >
      <View style={styles.indicatorSlot}>
        <Animated.View
          style={[
            styles.indicator,
            { backgroundColor: scheme.primaryContainer },
            indicatorStyle,
          ]}
        />
        <Ionicons
          name={focused ? icons.active : icons.inactive}
          size={24}
          color={focused ? scheme.onPrimaryContainer : scheme.onSurfaceVariant}
        />
      </View>
      <Text
        variant="labelSmall"
        color={focused ? scheme.onSurface : scheme.onSurfaceVariant}
        style={styles.label}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function NavigationBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { scheme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: scheme.surfaceContainer,
          borderTopColor: scheme.outlineVariant,
          // La barra absorbe el inset inferior: el contenido llega al borde real
          // de la pantalla y los gestos del sistema siguen teniendo su franja.
          paddingBottom: insets.bottom,
          height: NAV_BAR_HEIGHT + insets.bottom,
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const label =
          typeof options.tabBarLabel === 'string'
            ? options.tabBarLabel
            : options.title ?? route.name;

        return (
          <NavItem
            key={route.key}
            focused={focused}
            routeName={route.name}
            label={label}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            }}
            onLongPress={() => {
              navigation.emit({ type: 'tabLongPress', target: route.key });
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: SPACING.sm,
    minHeight: TOUCH.min,
  },
  indicatorSlot: {
    width: 56,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  indicator: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: SHAPE.full,
  },
  label: {
    marginTop: 2,
  },
});
