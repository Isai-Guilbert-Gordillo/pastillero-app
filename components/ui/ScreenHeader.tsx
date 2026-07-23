import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BORDER_RADIUS, FONTS, GRADIENTS, SPACING } from '@/lib/theme';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  rightElement?: React.ReactNode;
  children?: React.ReactNode;
  align?: 'row' | 'column';
}

export default function ScreenHeader({ title, subtitle, rightElement, children, align = 'row' }: ScreenHeaderProps) {
  return (
    <LinearGradient
      colors={GRADIENTS.primary}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.header}
    >
      <View style={[styles.row, align === 'column' && styles.column]}>
        <View style={styles.textBlock}>
          <Text style={styles.title}>{title}</Text>
          {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
        {rightElement}
      </View>
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg + 4,
    borderBottomLeftRadius: BORDER_RADIUS.xl,
    borderBottomRightRadius: BORDER_RADIUS.xl,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  column: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  textBlock: {
    flex: 1,
  },
  title: {
    fontSize: FONTS.sizeTitle,
    fontFamily: FONTS.family.bold,
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: FONTS.sizeMedium,
    fontFamily: FONTS.family.medium,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
  },
});
