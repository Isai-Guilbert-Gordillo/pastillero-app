// ARCHIVO TEMPORAL DE VERIFICACIÓN — borrar después de revisar.
import Button from '@/components/ui/Button';
import Fab from '@/components/ui/Fab';
import Surface from '@/components/ui/Surface';
import Text from '@/components/ui/Text';
import TopAppBar from '@/components/ui/TopAppBar';
import { useTheme } from '@/context/ThemeContext';
import { NAV_BAR_HEIGHT, SCREEN_MARGIN, SHAPE, SPACING, TOUCH } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, View } from 'react-native';

const MEDS = ['prueba3', 'Levotiroxina sódica de liberación prolongada', 'Metformina', 'Losartán', 'Atorvastatina'];

export default function FabCheck() {
  const { scheme } = useTheme();
  const [extended, setExtended] = useState(true);
  const last = useRef(0);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const delta = y - last.current;
    if (y <= 8) { if (!extended) setExtended(true); }
    else if (delta > 6) { if (extended) setExtended(false); }
    else if (delta < -6) { if (!extended) setExtended(true); }
    last.current = y;
  };

  return (
    <View style={{ flex: 1, backgroundColor: scheme.background }}>
      <TopAppBar title="Hola, Isai" subtitle="domingo, 26 de julio" />
      <ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingHorizontal: SCREEN_MARGIN,
          paddingBottom: NAV_BAR_HEIGHT + TOUCH.primary + SPACING.xl,
        }}
      >
        <View style={[s.pendingRow, { backgroundColor: scheme.surfaceContainer }]}>
          <View style={s.pendingHeader}>
            <Ionicons name="alarm-outline" size={26} color={scheme.warning} />
            <View style={s.flex}>
              <Text variant="titleSmall">prueba3</Text>
              <Text variant="bodySmall" tone="variant">1 mg · pendiente de confirmar</Text>
            </View>
          </View>
          <Button title="Ya la tomé" icon="checkmark-circle" variant="tonal" onPress={() => {}} style={s.pendingButton} />
        </View>

        {MEDS.map((m) => (
          <Surface key={m} level={1} style={s.doseCard}>
            <View style={[s.well, { backgroundColor: scheme.tertiaryContainer }]}>
              <Ionicons name="medical" size={34} color={scheme.tertiary} />
            </View>
            <View style={s.flex}>
              <Text variant="titleMedium" numberOfLines={2}>{m}</Text>
              <Text variant="bodySmall" tone="variant">125 mg · cada 24 h</Text>
            </View>
            <Ionicons name="chevron-forward" size={26} color={scheme.onSurfaceVariant} />
          </Surface>
        ))}
      </ScrollView>

      <Fab
        label="Agregar medicamento"
        extended={extended}
        onPress={() => {}}
        style={[s.fab, { bottom: NAV_BAR_HEIGHT + SPACING.lg }]}
      />
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  pendingRow: { borderRadius: SHAPE.medium, padding: SPACING.lg, marginBottom: SPACING.sm },
  pendingHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  pendingButton: { marginTop: SPACING.md },
  doseCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.lg, padding: SPACING.lg, marginBottom: SPACING.md },
  well: { width: 72, height: 72, borderRadius: SHAPE.medium, justifyContent: 'center', alignItems: 'center' },
  fab: { position: 'absolute', right: SCREEN_MARGIN },
});
