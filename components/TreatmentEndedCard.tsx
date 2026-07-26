import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Button from '@/components/ui/Button';
import IconBadge from '@/components/ui/IconBadge';
import Surface from '@/components/ui/Surface';
import Text from '@/components/ui/Text';
import TextField from '@/components/ui/TextField';
import { useTheme } from '@/context/ThemeContext';
import { SCREEN_MARGIN, SHAPE, SPACING } from '@/lib/theme';
import { Medication } from '@/lib/types';

interface TreatmentEndedCardProps {
  medication: Medication;
  taken: number;
  total: number;
  onFinish: () => void;
  onExtend: (extraDays: number) => void;
  loading?: boolean;
}

/**
 * Se muestra cuando un tratamiento "por unos días" llegó a su end_date sin que
 * nadie lo haya cerrado. En vez de apagar las notificaciones en silencio, esta
 * tarjeta le da un cierre explícito: un resumen de adherencia y dos caminos —
 * terminar de verdad, o avisar que el doctor lo extendió (sin perder el conteo
 * de dosis ya tomadas).
 *
 * Diseño: el conteo "tomaste X de Y" era solo texto, así que un 3 de 21 se leía
 * igual de tranquilo que un 20 de 21. Ahora el dato tiene forma —una barra de
 * progreso determinada de Material— y el número grande manda. Los dos caminos
 * son `filled` + `tonal`, no dos botones idénticos: cerrar es lo esperado,
 * extender es la excepción real.
 */
export default function TreatmentEndedCard({
  medication,
  taken,
  total,
  onFinish,
  onExtend,
  loading,
}: TreatmentEndedCardProps) {
  const { scheme } = useTheme();
  const [extending, setExtending] = useState(false);
  const [extraDays, setExtraDays] = useState('');
  const [error, setError] = useState<string | null>(null);

  const ratio = total > 0 ? Math.min(1, taken / total) : 0;

  const handleConfirmExtend = () => {
    const n = Number(extraDays);
    if (!extraDays || isNaN(n) || n <= 0) {
      setError('Escribe cuántos días más, por ejemplo 7.');
      return;
    }
    setError(null);
    onExtend(n);
  };

  return (
    <Surface level={1} padded borderColor={scheme.primary} style={styles.card}>
      <View style={styles.header}>
        <IconBadge
          name="flag"
          color={scheme.onPrimaryContainer}
          backgroundColor={scheme.primaryContainer}
          size={48}
        />
        <View style={styles.headerText}>
          <Text variant="titleMedium">Tratamiento terminado</Text>
          <Text variant="bodySmall" tone="variant">
            {medication.name} — {medication.dose_mg} mg
          </Text>
        </View>
      </View>

      <View style={[styles.summary, { backgroundColor: scheme.surfaceContainer }]}>
        <View style={styles.summaryNumbers}>
          <Text variant="displaySmall" tone="primary">
            {taken}
          </Text>
          <Text variant="titleMedium" tone="variant" style={styles.summaryOf}>
            de {total} dosis tomadas
          </Text>
        </View>
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: total, now: taken }}
          style={[styles.track, { backgroundColor: scheme.surfaceVariant }]}
        >
          <View
            style={[
              styles.trackFill,
              { width: `${ratio * 100}%`, backgroundColor: scheme.primary },
            ]}
          />
        </View>
      </View>

      {!extending ? (
        <View style={styles.actions}>
          <Button title="Ya terminé" icon="checkmark-circle" onPress={onFinish} loading={loading} />
          <Button
            title="El doctor lo extendió"
            icon="calendar"
            variant="tonal"
            onPress={() => setExtending(true)}
            disabled={loading}
          />
        </View>
      ) : (
        <View style={styles.actions}>
          <TextField
            label="¿Cuántos días más?"
            placeholder="7"
            value={extraDays}
            onChangeText={(t) => {
              setExtraDays(t);
              if (error) setError(null);
            }}
            keyboardType="numeric"
            suffix="días"
            error={error}
            autoFocus
          />
          <Button
            title="Confirmar nueva fecha"
            icon="checkmark-circle"
            onPress={handleConfirmExtend}
            loading={loading}
          />
          <Button title="Cancelar" variant="text" onPress={() => setExtending(false)} />
        </View>
      )}
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: SCREEN_MARGIN,
    marginBottom: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  headerText: {
    flex: 1,
  },
  summary: {
    borderRadius: SHAPE.medium,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  summaryNumbers: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: SPACING.sm,
  },
  summaryOf: {
    flex: 1,
  },
  track: {
    height: 8,
    borderRadius: SHAPE.full,
    marginTop: SPACING.md,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: SHAPE.full,
  },
  actions: {
    gap: SPACING.md,
  },
});
