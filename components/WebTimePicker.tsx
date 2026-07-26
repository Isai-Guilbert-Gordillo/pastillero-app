import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Text from '@/components/ui/Text';
import { useTheme, useThemedStyles } from '@/context/ThemeContext';
import { ColorScheme, SCREEN_MARGIN, SHAPE, SPACING, TOUCH, elevation } from '@/lib/theme';

// Selector de hora solo para la build web (dev). En Android/iOS se usa el
// selector nativo del sistema. Sigue el mismo lenguaje que el resto del sistema
// —diálogo de esquina 28dp, opciones con contenedor tonal— para que la vista
// previa en el navegador no mienta sobre cómo se ve la app real.

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1); // 1-12
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5); // 0,5,10...55

interface WebTimePickerProps {
  visible: boolean;
  initialTime: string; // "HH:mm" 24h
  onCancel: () => void;
  onConfirm: (time24: string) => void;
}

export default function WebTimePicker({ visible, initialTime, onCancel, onConfirm }: WebTimePickerProps) {
  const { scheme } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [h24, m] = initialTime.split(':').map(Number);
  const initialPeriod: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
  const initialHour12 = h24 % 12 || 12;

  const [hour, setHour] = useState(initialHour12);
  const [minute, setMinute] = useState(Math.round(m / 5) * 5 === 60 ? 0 : Math.round(m / 5) * 5);
  const [period, setPeriod] = useState<'AM' | 'PM'>(initialPeriod);

  const handleConfirm = () => {
    let h = hour % 12;
    if (period === 'PM') h += 12;
    const time24 = `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    onConfirm(time24);
  };

  const Option = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.option,
        {
          backgroundColor: active ? scheme.primaryContainer : scheme.surfaceContainer,
        },
      ]}
    >
      <Text variant="labelLarge" color={active ? scheme.onPrimaryContainer : scheme.onSurface}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Animated.View entering={FadeIn.duration(150)} style={styles.overlay}>
        <View style={styles.card}>
          <Text variant="headlineSmall" style={styles.title}>
            Elige la hora
          </Text>

          <View style={styles.pickersRow}>
            <View style={styles.column}>
              <Text variant="labelSmall" tone="variant" style={styles.columnLabel}>
                HORA
              </Text>
              <ScrollView style={styles.scrollColumn} showsVerticalScrollIndicator={false}>
                {HOURS.map((hVal) => (
                  <Option key={hVal} label={String(hVal)} active={hour === hVal} onPress={() => setHour(hVal)} />
                ))}
              </ScrollView>
            </View>

            <View style={styles.column}>
              <Text variant="labelSmall" tone="variant" style={styles.columnLabel}>
                MINUTOS
              </Text>
              <ScrollView style={styles.scrollColumn} showsVerticalScrollIndicator={false}>
                {MINUTES.map((mVal) => (
                  <Option
                    key={mVal}
                    label={String(mVal).padStart(2, '0')}
                    active={minute === mVal}
                    onPress={() => setMinute(mVal)}
                  />
                ))}
              </ScrollView>
            </View>

            <View style={styles.column}>
              <Text variant="labelSmall" tone="variant" style={styles.columnLabel}>
                PERIODO
              </Text>
              <View style={styles.periodColumn}>
                {(['AM', 'PM'] as const).map((p) => (
                  <Option key={p} label={p} active={period === p} onPress={() => setPeriod(p)} />
                ))}
              </View>
            </View>
          </View>

          <View style={styles.preview}>
            <Text variant="displaySmall" tone="onPrimaryContainer">
              {hour}:{String(minute).padStart(2, '0')} {period}
            </Text>
          </View>

          <View style={styles.actions}>
            <Pressable onPress={onCancel} accessibilityRole="button" style={styles.action}>
              <Text variant="labelLarge" tone="variant">
                Cancelar
              </Text>
            </Pressable>
            <Pressable onPress={handleConfirm} accessibilityRole="button" style={styles.action}>
              <Text variant="labelLarge" tone="primary">
                Confirmar
              </Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const makeStyles = (t: ColorScheme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: t.scrim,
      justifyContent: 'center',
      alignItems: 'center',
      padding: SCREEN_MARGIN,
    },
    card: {
      backgroundColor: t.surface,
      borderRadius: SHAPE.extraLarge,
      padding: SPACING.xl,
      width: '100%',
      maxWidth: 420,
      ...elevation(4, t),
    },
    title: {
      marginBottom: SPACING.lg,
    },
    pickersRow: {
      flexDirection: 'row',
      gap: SPACING.sm,
    },
    column: {
      flex: 1,
    },
    columnLabel: {
      marginBottom: SPACING.sm,
      textAlign: 'center',
    },
    scrollColumn: {
      height: 220,
    },
    periodColumn: {
      gap: SPACING.sm,
    },
    option: {
      minHeight: 56,
      borderRadius: SHAPE.small,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: SPACING.sm,
    },
    preview: {
      marginTop: SPACING.lg,
      backgroundColor: t.primaryContainer,
      borderRadius: SHAPE.medium,
      padding: SPACING.lg,
      alignItems: 'center',
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: SPACING.sm,
      marginTop: SPACING.xl,
    },
    action: {
      minHeight: TOUCH.min,
      justifyContent: 'center',
      paddingHorizontal: SPACING.xl,
      borderRadius: SHAPE.full,
    },
  });
