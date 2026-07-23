import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { BORDER_RADIUS, COLORS, FONTS, SHADOWS, SPACING, TOUCH_TARGET } from '@/lib/theme';

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1); // 1-12
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5); // 0,5,10...55

interface WebTimePickerProps {
  visible: boolean;
  initialTime: string; // "HH:mm" 24h
  onCancel: () => void;
  onConfirm: (time24: string) => void;
}

export default function WebTimePicker({ visible, initialTime, onCancel, onConfirm }: WebTimePickerProps) {
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

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Animated.View entering={FadeIn.duration(150)} style={styles.overlay}>
        <Animated.View entering={ZoomIn.duration(200).springify().damping(16)} style={styles.card}>
          <Text style={styles.title}>Elige la hora</Text>

          <View style={styles.pickersRow}>
            {/* Hora */}
            <View style={styles.column}>
              <Text style={styles.columnLabel}>Hora</Text>
              <ScrollView style={styles.scrollColumn} showsVerticalScrollIndicator={false}>
                {HOURS.map((hVal) => (
                  <TouchableOpacity
                    key={hVal}
                    style={[styles.option, hour === hVal && styles.optionActive]}
                    onPress={() => setHour(hVal)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.optionText, hour === hVal && styles.optionTextActive]}>{hVal}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Minutos */}
            <View style={styles.column}>
              <Text style={styles.columnLabel}>Minutos</Text>
              <ScrollView style={styles.scrollColumn} showsVerticalScrollIndicator={false}>
                {MINUTES.map((mVal) => (
                  <TouchableOpacity
                    key={mVal}
                    style={[styles.option, minute === mVal && styles.optionActive]}
                    onPress={() => setMinute(mVal)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.optionText, minute === mVal && styles.optionTextActive]}>
                      {String(mVal).padStart(2, '0')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* AM/PM */}
            <View style={styles.column}>
              <Text style={styles.columnLabel}>Periodo</Text>
              <View style={styles.periodColumn}>
                {(['AM', 'PM'] as const).map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.option, period === p && styles.optionActive]}
                    onPress={() => setPeriod(p)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.optionText, period === p && styles.optionTextActive]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.preview}>
            <Text style={styles.previewText}>
              {hour}:{String(minute).padStart(2, '0')} {period}
            </Text>
          </View>

          <View style={styles.buttonsRow}>
            <TouchableOpacity style={[styles.button, styles.buttonCancel]} onPress={onCancel} activeOpacity={0.7}>
              <Text style={styles.buttonTextCancel}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={handleConfirm} activeOpacity={0.7}>
              <Text style={styles.buttonText}>Confirmar</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    width: '100%',
    maxWidth: 420,
    ...SHADOWS.floating,
  },
  title: {
    fontSize: FONTS.sizeLarge,
    fontFamily: FONTS.family.bold,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  pickersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  column: {
    flex: 1,
    alignItems: 'center',
  },
  columnLabel: {
    fontSize: FONTS.sizeSmall,
    fontFamily: FONTS.family.semiBold,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  scrollColumn: {
    height: 220,
    width: '100%',
  },
  periodColumn: {
    gap: SPACING.sm,
    width: '100%',
  },
  option: {
    minHeight: TOUCH_TARGET.minHeight - 8,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.inputBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  optionActive: {
    backgroundColor: COLORS.primary,
  },
  optionText: {
    fontSize: FONTS.sizeMedium,
    fontFamily: FONTS.family.semiBold,
    color: COLORS.text,
  },
  optionTextActive: {
    color: COLORS.white,
    fontFamily: FONTS.family.bold,
  },
  preview: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.primaryBg,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
  },
  previewText: {
    fontSize: FONTS.sizeXLarge,
    fontFamily: FONTS.family.bold,
    color: COLORS.primary,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  button: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    minHeight: TOUCH_TARGET.minHeight,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.button,
  },
  buttonCancel: {
    backgroundColor: COLORS.inputBg,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    fontSize: FONTS.sizeMedium,
    fontFamily: FONTS.family.bold,
    color: COLORS.white,
  },
  buttonTextCancel: {
    fontSize: FONTS.sizeMedium,
    fontFamily: FONTS.family.bold,
    color: COLORS.textSecondary,
  },
});
