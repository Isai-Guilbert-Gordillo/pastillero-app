import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '@/lib/theme';

// Banner placeholder compatible con Expo Go.
// Para AdMob real en producción, instala react-native-google-mobile-ads,
// agrega el plugin en app.json y haz un build nativo con EAS.

export function AdBanner() {
  return (
    <View style={styles.placeholder}>
      <Ionicons name="megaphone-outline" size={20} color={COLORS.textLight} />
      <Text style={styles.placeholderText}>Espacio publicitario</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    height: 56,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  placeholderText: {
    fontSize: FONTS.sizeSmall,
    color: COLORS.textLight,
  },
});
