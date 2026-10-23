import DonMemo from '@/components/DonMemo';
import { useFeedback } from '@/components/Feedback';
import Button from '@/components/ui/Button';
import Surface from '@/components/ui/Surface';
import Text from '@/components/ui/Text';
import { useAuth } from '@/context/AuthContext';
import { useCaregiver } from '@/context/CaregiverContext';
import { useTheme, useThemedStyles } from '@/context/ThemeContext';
import { computeDoseDatesInRange, saveDoseTakenWithRetry } from '@/lib/doseSync';
import { supabase } from '@/lib/supabase';
import { ColorScheme, SCREEN_MARGIN, SHAPE, SPACING, TOUCH } from '@/lib/theme';
import { Medication } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─────────────────────────────────────────────────────────────────────────────
// Familia — la casa del cuidador.
//
// Hasta ahora, para saber si su mamá se tomó las pastillas, el cuidador tenía
// que entrar a Perfil y CAMBIAR DE CUENTA: dejar de ser él para mirar la
// pantalla de otra persona, diseñada para esa otra persona. La app estaba
// construida entera alrededor del paciente, y el único con motivo para abrirla
// todos los días era el cuidador.
//
// Esta pantalla responde UNA pregunta —"¿se la tomó?"— sin cambiar de cuenta y
// sin navegar. Solo aparece si cuidas a alguien (ver (tabs)/_layout.tsx).
//
// Sobre marcar dosis: el cuidador puede confirmar una toma que el paciente le
// dijo por teléfono, y queda guardada con `confirmed_by` distinto de `user_id`
// para que el historial no mezcle "lo vi" con "me lo dijeron". Esa distinción
// es lo que mantiene el registro utilizable como dato de salud.
// ─────────────────────────────────────────────────────────────────────────────

interface DoseSlot {
  key: string;
  medicationId: string;
  medicationName: string;
  doseMg: number;
  at: Date;
  state: 'taken' | 'missed' | 'pending' | 'future';
}

interface PatientStatus {
  patientId: string;
  label: string;
  taken: number;
  due: number;
  pending: DoseSlot[];
  next: DoseSlot | null;
  sinMedicamentos: boolean;
}

const formatTime = (d: Date) => {
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${m} ${suffix}`;
};

/** "maria.gonzalez@gmail.com" → "Maria.gonzalez". Mejor que el correo entero. */
const nameFromEmail = (email: string) => {
  const local = email.split('@')[0] ?? email;
  return local.charAt(0).toUpperCase() + local.slice(1);
};

export default function CareScreen() {
  const { user } = useAuth();
  const { linkedPatients, switchToPatient } = useCaregiver();
  const { scheme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { snack } = useFeedback();

  const [statuses, setStatuses] = useState<PatientStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [marking, setMarking] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (linkedPatients.length === 0) {
      setStatuses([]);
      setLoading(false);
      return;
    }

    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 86400000 - 1);

    const result: PatientStatus[] = [];

    for (const p of linkedPatients) {
      // RLS deja leer esto: is_caregiver_of() ya autoriza al cuidador aceptado.
      const [{ data: meds }, { data: records }] = await Promise.all([
        supabase
          .from('medications')
          .select('*')
          .eq('user_id', p.patientId)
          .eq('active', true),
        supabase
          .from('dose_records')
          .select('id, medication_id, scheduled_at, taken')
          .eq('user_id', p.patientId)
          .gte('scheduled_at', dayStart.toISOString())
          .lte('scheduled_at', dayEnd.toISOString()),
      ]);

      const recordByKey = new Map<string, { taken: boolean | null }>();
      for (const r of records ?? []) {
        recordByKey.set(
          `${r.medication_id}_${new Date(r.scheduled_at).toISOString()}`,
          { taken: r.taken }
        );
      }

      const slots: DoseSlot[] = [];
      for (const med of (meds ?? []) as Medication[]) {
        // Mismo recorte que el Historial: nada antes de que el medicamento
        // existiera, nada después de que el tratamiento terminara.
        let from = dayStart;
        let to = dayEnd;
        const createdAt = new Date(med.created_at);
        if (createdAt > from) from = createdAt;
        if (med.regimen_type === 'por_tiempo' && med.end_date) {
          const end = new Date(`${med.end_date}T23:59:59`);
          if (end < to) to = end;
        }
        if (from >= to) continue;

        for (const at of computeDoseDatesInRange(med, from, to)) {
          const key = `${med.id}_${at.toISOString()}`;
          const rec = recordByKey.get(key);
          const state: DoseSlot['state'] =
            rec?.taken === true ? 'taken'
            : rec?.taken === false ? 'missed'
            : !rec && at.getTime() > now.getTime() ? 'future'
            : 'pending';
          slots.push({
            key,
            medicationId: med.id,
            medicationName: med.name,
            doseMg: med.dose_mg,
            at,
            state,
          });
        }
      }

      slots.sort((a, b) => a.at.getTime() - b.at.getTime());

      const due = slots.filter((s) => s.state !== 'future').length;
      const taken = slots.filter((s) => s.state === 'taken').length;

      result.push({
        patientId: p.patientId,
        label: nameFromEmail(p.patientEmail),
        taken,
        due,
        pending: slots.filter((s) => s.state === 'pending' || s.state === 'missed'),
        next: slots.find((s) => s.state === 'future') ?? null,
        sinMedicamentos: (meds ?? []).length === 0,
      });
    }

    setStatuses(result);
    setLoading(false);
  }, [linkedPatients]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const markTaken = async (patientId: string, slot: DoseSlot) => {
    if (!user) return;
    setMarking(slot.key);
    // `confirmed_by` = quien toca aquí (el cuidador); `user_id` sigue siendo
    // el paciente. Es la diferencia entre "lo vi" y "me lo dijeron".
    const ok = await saveDoseTakenWithRetry(
      patientId,
      slot.medicationId,
      slot.at.toISOString(),
      user.id
    );
    setMarking(null);
    if (ok) {
      snack(`Anotada la dosis de ${slot.medicationName}.`, { tone: 'success' });
      load();
    } else {
      snack('No se pudo guardar. Revisa tu conexión.', { tone: 'error' });
    }
  };

  const abrirCuenta = (p: PatientStatus) => {
    const link = linkedPatients.find((l) => l.patientId === p.patientId);
    if (!link) return;
    switchToPatient(link.patientId, link.patientEmail);
    router.push('/(tabs)');
  };

  // ─── Una tarjeta por persona cuidada ───
  const renderPatient = (p: PatientStatus) => {
    const todoBien = p.due > 0 && p.taken === p.due;
    const ratio = p.due > 0 ? p.taken / p.due : 0;

    return (
      <Surface level={1} padded key={p.patientId} style={styles.card}>
        <View style={styles.cardHeader}>
          <DonMemo size={44} variant="head" idle={false} />
          <View style={styles.flex}>
            <Text variant="titleMedium" numberOfLines={1}>
              {p.label}
            </Text>
            <Text variant="bodySmall" tone="variant">
              {p.sinMedicamentos
                ? 'Todavía no tiene medicamentos'
                : p.due === 0
                  ? 'Hoy no le toca ninguna dosis'
                  : `Hoy: ${p.taken} de ${p.due} tomadas`}
            </Text>
          </View>
          {todoBien && (
            <Ionicons name="checkmark-circle" size={30} color={scheme.success} />
          )}
        </View>

        {p.due > 0 && (
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: p.due, now: p.taken }}
            style={[styles.track, { backgroundColor: scheme.surfaceVariant }]}
          >
            <View
              style={[
                styles.trackFill,
                {
                  width: `${ratio * 100}%`,
                  backgroundColor: todoBien ? scheme.success : scheme.primary,
                },
              ]}
            />
          </View>
        )}

        {/* Lo que falta por confirmar — el motivo real de entrar aquí */}
        {p.pending.length > 0 && (
          <View style={styles.pendingBlock}>
            <Text variant="labelMedium" tone="variant" style={styles.pendingLabel}>
              SIN CONFIRMAR
            </Text>
            {p.pending.map((slot) => (
              <View key={slot.key} style={styles.pendingRow}>
                <View style={styles.flex}>
                  <Text variant="titleSmall">{slot.medicationName}</Text>
                  <Text variant="bodySmall" tone="variant">
                    {slot.doseMg} mg · {formatTime(slot.at)}
                  </Text>
                </View>
                <Button
                  title="Ya la tomó"
                  icon="checkmark"
                  variant="tonal"
                  fullWidth={false}
                  loading={marking === slot.key}
                  onPress={() => markTaken(p.patientId, slot)}
                />
              </View>
            ))}
          </View>
        )}

        {p.next && (
          <View style={[styles.nextRow, { backgroundColor: scheme.surfaceContainer }]}>
            <Ionicons name="alarm-outline" size={22} color={scheme.primary} />
            <Text variant="bodySmall" tone="variant" style={styles.flex}>
              Siguiente: {p.next.medicationName} a las {formatTime(p.next.at)}
            </Text>
          </View>
        )}

        <Button
          title="Ver su cuenta completa"
          variant="text"
          onPress={() => abrirCuenta(p)}
          style={styles.openAccount}
        />
      </Surface>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + SPACING.xl },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[scheme.primary]}
            tintColor={scheme.primary}
            progressBackgroundColor={scheme.surface}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <Text variant="headlineMedium">Familia</Text>
        <Text variant="bodyMedium" tone="variant" style={styles.subtitle}>
          Cómo van las personas que cuidas
        </Text>

        {loading ? (
          <ActivityIndicator color={scheme.primary} style={styles.loader} />
        ) : statuses.length === 0 ? (
          // La pestaña no debería existir sin pacientes (href: null en
          // (tabs)/_layout.tsx), pero si se llega aquí de algún modo, vale más
          // explicar cómo vincular a alguien que mostrar una pantalla muda.
          <View style={styles.empty}>
            <DonMemo size={96} gesture="greet" />
            <Text variant="titleMedium" center style={styles.emptyTitle}>
              Todavía no cuidas a nadie
            </Text>
            <Text variant="bodyMedium" tone="variant" center style={styles.emptyText}>
              Pídele a tu familiar que genere un código desde su Perfil, y
              escríbelo en el tuyo para quedar vinculados.
            </Text>
            <Button
              title="Ir a Perfil"
              icon="person-outline"
              variant="outlined"
              onPress={() => router.push('/(tabs)/profile')}
            />
          </View>
        ) : (
          statuses.map(renderPatient)
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (t: ColorScheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.background,
    },
    flex: {
      flex: 1,
    },
    scroll: {
      paddingHorizontal: SCREEN_MARGIN,
      paddingBottom: SPACING.xxl,
    },
    subtitle: {
      marginTop: SPACING.xs,
      marginBottom: SPACING.xl,
    },
    loader: {
      marginTop: SPACING.xxxl,
    },
    empty: {
      alignItems: 'center',
      paddingVertical: SPACING.xxl,
    },
    emptyTitle: {
      marginTop: SPACING.xl,
    },
    emptyText: {
      marginTop: SPACING.md,
      marginBottom: SPACING.xl,
    },
    card: {
      marginBottom: SPACING.lg,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
    },
    track: {
      height: 8,
      borderRadius: SHAPE.full,
      overflow: 'hidden',
      marginTop: SPACING.lg,
    },
    trackFill: {
      height: '100%',
      borderRadius: SHAPE.full,
    },
    pendingBlock: {
      marginTop: SPACING.xl,
    },
    pendingLabel: {
      marginBottom: SPACING.sm,
    },
    pendingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      minHeight: TOUCH.min,
      paddingVertical: SPACING.xs,
    },
    nextRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      marginTop: SPACING.lg,
      padding: SPACING.md,
      borderRadius: SHAPE.medium,
    },
    openAccount: {
      marginTop: SPACING.md,
    },
  });
