import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCaregiver } from '@/context/CaregiverContext';
import { BORDER_RADIUS, COLORS, FONTS, SPACING } from '@/lib/theme';

/** Aviso persistente cuando un cuidador está viendo/editando la cuenta de otra persona. */
export default function PatientBanner() {
  const { isViewingOther, activePatientLabel, switchToSelf } = useCaregiver();

  if (!isViewingOther) return null;

  return (
    <View style={styles.banner}>
      <Ionicons name="eye" size={20} color={COLORS.white} />
      <Text style={styles.text} numberOfLines={1}>
        Viendo la cuenta de {activePatientLabel}
      </Text>
      <TouchableOpacity onPress={switchToSelf} activeOpacity={0.7} style={styles.button}>
        <Text style={styles.buttonText}>Volver a la mía</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.secondary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
  },
  text: {
    flex: 1,
    color: COLORS.white,
    fontSize: FONTS.sizeSmall,
    fontFamily: FONTS.family.semiBold,
  },
  button: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 6,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: FONTS.sizeSmall - 2,
    fontFamily: FONTS.family.bold,
  },
});
