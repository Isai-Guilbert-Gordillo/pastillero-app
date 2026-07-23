import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BORDER_RADIUS } from '@/lib/theme';

interface IconBadgeProps {
  name: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  backgroundColor: string;
  size?: number;
  iconSize?: number;
}

export default function IconBadge({ name, color, backgroundColor, size = 42, iconSize }: IconBadgeProps) {
  return (
    <View
      style={[
        styles.badge,
        { width: size, height: size, borderRadius: size / 2, backgroundColor },
      ]}
    >
      <Ionicons name={name} size={iconSize ?? Math.round(size * 0.52)} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.full,
  },
});
