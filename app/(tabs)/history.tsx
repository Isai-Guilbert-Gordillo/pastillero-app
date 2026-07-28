import { useFeedback } from '@/components/Feedback';
import PatientBanner from '@/components/PatientBanner';
import DoseStatus, { DoseState, DoseStatusLegend } from '@/components/ui/DoseStatus';
import Surface from '@/components/ui/Surface';
import Text from '@/components/ui/Text';
import TopAppBar from '@/components/ui/TopAppBar';
import { useCaregiver } from '@/context/CaregiverContext';
import { useTheme, useThemedStyles } from '@/context/ThemeContext';
import { computeDoseDatesInRange, reconcileDoseRecords } from '@/lib/doseSync';
import { supabase } from '@/lib/supabase';
import {
    ColorScheme,
    SCREEN_MARGIN,
    SHAPE,
    SPACING,
    STATE_LAYER,
    TOUCH,
    withAlpha,
} from '@/lib/theme';
import { Medication } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
// Historial.
//
// La versión anterior era una tabla de 7 columnas con scroll HORIZONTAL, celdas
// de 118px y texto de 12.5px. Para el público de esta app eso es ilegible dos
// veces: por el tamaño y por el gesto — una tabla que se desliza de lado esconde
// la mitad de la semana detrás de un movimiento que nadie descubre solo (había
// que ponerle un cartelito "desliza hacia los lados", que es la confesión de que
// el patrón no funcionaba).
//
// Ahora la semana es una TIRA de días arriba —siempre visible, siete objetivos
// de 64dp— y el día seleccionado se abre abajo como una línea de tiempo vertical
// a tamaño completo. Nada de scroll horizontal, nada por debajo de 16sp.
//
// Cada día de la tira lleva su propio semáforo en miniatura, así que la semana
// entera se lee de un vistazo sin abrir un solo día.
// ─────────────────────────────────────────────────────────────────────────────

const DAY_LABELS_SHORT = ['L', 'M', 'MI', 'J', 'V', 'S', 'D'];
const DAY_LABELS_FULL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const MONTH_LABELS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function getMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=domingo .. 6=sábado
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatTime12h(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

function formatWeekRange(weekStart: Date): string {
  const end = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
  const sameMonth = weekStart.getMonth() === end.getMonth();
  if (sameMonth) {
    return `${weekStart.getDate()} – ${end.getDate()} de ${MONTH_LABELS[end.getMonth()]}`;
  }
  return `${weekStart.getDate()} de ${MONTH_LABELS[weekStart.getMonth()]} – ${end.getDate()} de ${MONTH_LABELS[end.getMonth()]}`;
}

interface DoseEntry {
  key: string;
  medicationId: string;
  medicationName: string;
  doseMg: number;
  scheduledAt: Date;
  timeKey: string;
  recordId: string | null;
  state: DoseState;
}

/** Un día de la semana con todas sus dosis, ordenadas por hora. */
interface DayColumn {
  date: Date;
  entries: DoseEntry[];
}

const EMPTY_WEEK = (weekStart: Date): DayColumn[] =>
  Array.from({ length: 7 }, (_, i) => ({
    date: new Date(weekStart.getTime() + i * 86400000),
    entries: [],
  }));

export default function HistoryScreen() {
  const { activePatientId } = useCaregiver();
  const { scheme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { alert, snack } = useFeedback();

  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [days, setDays] = useState<DayColumn[]>(() => EMPTY_WEEK(getMonday(new Date())));
  const [selectedDay, setSelectedDay] = useState<number>(() => (new Date().getDay() + 6) % 7);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const weekEnd = useMemo(() => new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000), [weekStart]);
  const isCurrentWeek = useMemo(
    () => getMonday(new Date()).getTime() === weekStart.getTime(),
    [weekStart]
  );

  // ─── Arma el rol semanal ───
  // Solo medicamentos ACTIVOS — "eliminar" en esta app es borrado suave
  // (`active = false`, ver details/[id].tsx), la fila sigue en la base de
  // datos. Se probó mostrar también los inactivos (para no perder historial
  // de una semana pasada donde SÍ estuvieron vigentes), pero como no hay
  // fecha de cuándo se desactivaron, se proyectaban dosis futuras de
  // medicamentos que el usuario ya había borrado — confuso. Se prioriza que
  // el historial coincida con lo que Inicio considera "vigente ahora mismo".
  // Para cada medicamento se proyectan sus horas de dosis dentro de la
  // semana con la misma lógica que usa el resto de la app
  // (computeDoseDatesInRange, ver doseSync.ts), y se cruzan con los
  // dose_records reales para saber si ya se confirmó o no.
  const fetchWeek = useCallback(async () => {
    if (!activePatientId) return;
    setLoading(true);

    const { data: meds } = await supabase
      .from('medications')
      .select('*')
      .eq('user_id', activePatientId)
      .eq('active', true);

    const { data: records } = await supabase
      .from('dose_records')
      .select('id, medication_id, scheduled_at, taken')
      .eq('user_id', activePatientId)
      .gte('scheduled_at', weekStart.toISOString())
      .lt('scheduled_at', weekEnd.toISOString());

    // OJO: Postgres serializa timestamptz distinto a `.toISOString()` de JS
    // (ver lib/alarmQueue.ts) — se normaliza para que la comparación cuadre.
    const recordByKey = new Map<string, { id: string; taken: boolean | null }>();
    for (const r of records ?? []) {
      const key = `${r.medication_id}_${new Date(r.scheduled_at).toISOString()}`;
      recordByKey.set(key, { id: r.id, taken: r.taken });
    }

    const now = new Date();
    const week = EMPTY_WEEK(weekStart);

    for (const med of (meds ?? []) as Medication[]) {
      let from = weekStart;
      let to = weekEnd;

      const createdAt = new Date(med.created_at);
      if (createdAt > from) from = createdAt;
      if (med.regimen_type === 'por_tiempo' && med.end_date) {
        const end = new Date(`${med.end_date}T23:59:59`);
        if (end < to) to = new Date(end.getTime() + 1);
      }
      if (from >= to) continue;

      const doseDates = computeDoseDatesInRange(med, from, new Date(to.getTime() - 1));
      for (const date of doseDates) {
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayIdx = Math.round((dayStart.getTime() - weekStart.getTime()) / 86400000);
        if (dayIdx < 0 || dayIdx > 6) continue;

        const key = `${med.id}_${date.toISOString()}`;
        const rec = recordByKey.get(key);

        const state: DoseState =
          rec?.taken === true ? 'taken'
          : rec?.taken === false ? 'missed'
          : !rec && date.getTime() > now.getTime() ? 'future'
          : 'pending';

        week[dayIdx].entries.push({
          key,
          medicationId: med.id,
          medicationName: med.name,
          doseMg: med.dose_mg,
          scheduledAt: date,
          timeKey: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
          recordId: rec?.id ?? null,
          state,
        });
      }
    }

    for (const day of week) {
      day.entries.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
    }

    setDays(week);
    setLoading(false);
  }, [activePatientId, weekStart, weekEnd]);

  useFocusEffect(
    useCallback(() => {
      if (!activePatientId) return;
      reconcileDoseRecords(activePatientId)
        .catch((e) => console.log('Error reconciliando dosis:', e))
        .finally(fetchWeek);
    }, [activePatientId, fetchWeek])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchWeek();
    setRefreshing(false);
  };

  // Al cambiar de semana se conserva el día de la semana abierto (si venías
  // viendo el miércoles, sigues en miércoles), que es lo que se espera al
  // comparar una semana con la anterior.
  const goToToday = () => {
    setWeekStart(getMonday(new Date()));
    setSelectedDay((new Date().getDay() + 6) % 7);
  };
  const goPrevWeek = () => setWeekStart(new Date(weekStart.getTime() - 7 * 24 * 60 * 60 * 1000));
  const goNextWeek = () => setWeekStart(new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000));

  const handleMarkDose = async (recordId: string, taken: boolean) => {
    const { error } = await supabase
      .from('dose_records')
      .update({ taken, responded_at: new Date().toISOString() })
      .eq('id', recordId);
    if (error) {
      snack('No se pudo corregir el registro. Revisa tu conexión.', { tone: 'error' });
      return;
    }
    snack(taken ? 'Marcada como tomada.' : 'Marcada como no tomada.', { tone: 'success' });
    fetchWeek();
  };

  const handleEntryPress = (entry: DoseEntry) => {
    const dayLabel = DAY_LABELS_FULL[(entry.scheduledAt.getDay() + 6) % 7];
    const when = `${entry.medicationName} — ${dayLabel} ${entry.scheduledAt.getDate()} a las ${formatTime12h(entry.timeKey)}`;

    if (entry.state === 'future') {
      snack('Esa toma todavía no llega.');
      return;
    }
    if (!entry.recordId) {
      snack('Todavía no hay un registro guardado de esa toma.');
      return;
    }

    // Corregir un registro SÍ es una decisión que debe interrumpir: cambia el
    // dato de adherencia que un médico puede terminar leyendo.
    const buttons: { text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[] = [];
    if (entry.state !== 'taken') {
      buttons.push({ text: 'Sí la tomé', onPress: () => handleMarkDose(entry.recordId!, true) });
    }
    if (entry.state !== 'missed') {
      buttons.push({ text: 'No la tomé', onPress: () => handleMarkDose(entry.recordId!, false), style: 'destructive' });
    }
    buttons.push({ text: 'Cancelar', style: 'cancel' });
    alert('Corregir esta toma', when, buttons);
  };

  const syncPendingDoses = async () => {
    if (!activePatientId) return;
    const result = await reconcileDoseRecords(activePatientId);
    await fetchWeek();
    if (result.medsChecked === 0) {
      snack('No tienes medicamentos activos.');
    } else if (result.inserted === 0 && result.updatedToSkipped === 0) {
      snack('Tu historial ya está al día.', { tone: 'success' });
    } else {
      snack(
        `Historial actualizado: ${result.inserted} registro(s) nuevo(s), ${result.updatedToSkipped} marcado(s) como no tomados.`,
        { tone: 'success' }
      );
    }
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    if (y > 4 !== scrolled) setScrolled(y > 4);
  };

  // ─── Resumen de la semana ───
  const weekStats = useMemo(() => {
    let taken = 0;
    let due = 0;
    for (const day of days) {
      for (const entry of day.entries) {
        if (entry.state === 'future') continue;
        due += 1;
        if (entry.state === 'taken') taken += 1;
      }
    }
    return { taken, due, ratio: due > 0 ? taken / due : 0 };
  }, [days]);

  const selected = days[selectedDay];
  const today = new Date();

  return (
    <View style={styles.container}>
      <TopAppBar
        title="Historial"
        subtitle="Toca un día para ver sus tomas"
        scrolled={scrolled}
        actions={[{ icon: 'sync-outline', label: 'Actualizar historial', onPress: syncPendingDoses }]}
      />
      <PatientBanner />

      {/* ─── Navegación de semana ─── */}
      <View style={styles.weekNav}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Semana anterior"
          onPress={goPrevWeek}
          style={({ pressed }) => [styles.navArrow, pressed && { backgroundColor: withAlpha(scheme.onSurface, STATE_LAYER.pressed) }]}
        >
          <Ionicons name="chevron-back" size={28} color={scheme.onSurface} />
        </Pressable>

        <View style={styles.weekLabel}>
          <Text variant="titleSmall" center numberOfLines={1}>
            {formatWeekRange(weekStart)}
          </Text>
          <Text variant="labelSmall" tone="variant" center>
            {MONTH_LABELS[weekStart.getMonth()]} {weekStart.getFullYear()}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Semana siguiente"
          onPress={goNextWeek}
          style={({ pressed }) => [styles.navArrow, pressed && { backgroundColor: withAlpha(scheme.onSurface, STATE_LAYER.pressed) }]}
        >
          <Ionicons name="chevron-forward" size={28} color={scheme.onSurface} />
        </Pressable>
      </View>

      {/* ─── Tira de días: la semana entera, siempre visible ─── */}
      <View style={styles.dayStrip}>
        {days.map((day, index) => {
          const active = index === selectedDay;
          const isToday = isSameDay(day.date, today);
          const summary = day.entries.reduce(
            (acc, e) => ({ ...acc, [e.state]: (acc[e.state] ?? 0) + 1 }),
            {} as Partial<Record<DoseState, number>>
          );
          return (
            <Pressable
              key={index}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${DAY_LABELS_FULL[index]} ${day.date.getDate()}, ${day.entries.length} tomas`}
              onPress={() => setSelectedDay(index)}
              style={({ pressed }) => [
                styles.dayCell,
                active && { backgroundColor: scheme.primaryContainer },
                !active && isToday && { borderWidth: 1, borderColor: scheme.primary },
                pressed && !active && { backgroundColor: withAlpha(scheme.onSurface, STATE_LAYER.pressed) },
              ]}
            >
              <Text
                variant="labelSmall"
                color={active ? scheme.onPrimaryContainer : scheme.onSurfaceVariant}
              >
                {DAY_LABELS_SHORT[index]}
              </Text>
              <Text
                variant="titleSmall"
                color={active ? scheme.onPrimaryContainer : isToday ? scheme.primary : scheme.onSurface}
              >
                {day.date.getDate()}
              </Text>
              {/* Semáforo en miniatura: la semana completa se lee sin abrir nada. */}
              <View style={styles.dots}>
                {day.entries.length === 0 ? (
                  <View style={[styles.dot, { backgroundColor: 'transparent' }]} />
                ) : (
                  (['missed', 'pending', 'taken', 'future'] as DoseState[])
                    .filter((s) => summary[s])
                    .slice(0, 3)
                    .map((s) => (
                      <View
                        key={s}
                        style={[
                          styles.dot,
                          {
                            backgroundColor:
                              s === 'taken' ? scheme.success
                              : s === 'missed' ? scheme.error
                              : s === 'pending' ? scheme.warning
                              : scheme.outline,
                          },
                        ]}
                      />
                    ))
                )}
              </View>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={scheme.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          onScroll={onScroll}
          scrollEventThrottle={32}
          // Ni el inset inferior ni el alto de la barra de navegación: el área
          // de una pestaña ya termina arriba de la barra, y la barra ya absorbe
          // el inset. Sumarlos aquí dejaba ~104dp de espacio muerto al final.
          contentContainerStyle={[styles.scroll, { paddingBottom: SPACING.xxl }]}
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
          {/* ─── Resumen de la semana ─── */}
          {weekStats.due > 0 && (
            <Surface level={1} padded style={styles.summary}>
              <View style={styles.summaryRow}>
                <Text variant="displaySmall" tone="primary">
                  {weekStats.taken}
                </Text>
                <Text variant="titleSmall" tone="variant" style={styles.summaryOf}>
                  de {weekStats.due} tomas confirmadas esta semana
                </Text>
              </View>
              <View
                accessible
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 0, max: weekStats.due, now: weekStats.taken }}
                style={[styles.track, { backgroundColor: scheme.surfaceVariant }]}
              >
                <View
                  style={[
                    styles.trackFill,
                    { width: `${weekStats.ratio * 100}%`, backgroundColor: scheme.primary },
                  ]}
                />
              </View>
            </Surface>
          )}

          {/* ─── Día seleccionado ─── */}
          <Text variant="labelMedium" tone="variant" style={styles.dayHeader}>
            {DAY_LABELS_FULL[selectedDay].toUpperCase()} {selected.date.getDate()} DE{' '}
            {MONTH_LABELS[selected.date.getMonth()].toUpperCase()}
          </Text>

          {selected.entries.length === 0 ? (
            <Surface level={1} padded style={styles.emptyDay}>
              <Ionicons name="calendar-clear-outline" size={44} color={scheme.onSurfaceVariant} />
              <Text variant="titleSmall" center style={styles.emptyTitle}>
                Sin tomas este día
              </Text>
              <Text variant="bodySmall" tone="variant" center>
                No había ningún medicamento programado.
              </Text>
            </Surface>
          ) : (
            <Surface level={1} style={styles.timeline}>
              {selected.entries.map((entry, index) => {
                const showTime = index === 0 || selected.entries[index - 1].timeKey !== entry.timeKey;
                return (
                  <View key={entry.key}>
                    {showTime && (
                      <View style={styles.timeHeader}>
                        <Text variant="labelMedium" tone="primary">
                          {formatTime12h(entry.timeKey)}
                        </Text>
                        <View style={[styles.timeRule, { backgroundColor: scheme.outlineVariant }]} />
                      </View>
                    )}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${entry.medicationName}, ${entry.doseMg} miligramos, ${formatTime12h(entry.timeKey)}`}
                      accessibilityHint="Toca para corregir el registro"
                      onPress={() => handleEntryPress(entry)}
                      style={({ pressed }) => [
                        styles.entryRow,
                        pressed && { backgroundColor: withAlpha(scheme.onSurface, STATE_LAYER.pressed) },
                      ]}
                    >
                      <DoseStatus state={entry.state} size={44} />
                      <View style={styles.entryInfo}>
                        <Text variant="titleSmall" numberOfLines={2}>
                          {entry.medicationName}
                        </Text>
                        <Text variant="bodySmall" tone="variant">
                          {entry.doseMg} mg
                        </Text>
                      </View>
                      {entry.state !== 'future' && (
                        <Ionicons name="create-outline" size={24} color={scheme.onSurfaceVariant} />
                      )}
                    </Pressable>
                  </View>
                );
              })}
            </Surface>
          )}

          {/* ─── Leyenda ─── */}
          <View style={styles.legend}>
            <DoseStatusLegend state="taken" />
            <DoseStatusLegend state="missed" />
            <DoseStatusLegend state="pending" />
            <DoseStatusLegend state="future" />
          </View>

          {!isCurrentWeek && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Volver a la semana de hoy"
              onPress={goToToday}
              style={({ pressed }) => [
                styles.todayButton,
                { borderColor: scheme.outline },
                pressed && { backgroundColor: withAlpha(scheme.primary, STATE_LAYER.pressed) },
              ]}
            >
              <Ionicons name="today-outline" size={24} color={scheme.primary} />
              <Text variant="labelLarge" tone="primary">
                Volver a esta semana
              </Text>
            </Pressable>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (t: ColorScheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.background,
    },
    loadingBox: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scroll: {
      paddingHorizontal: SCREEN_MARGIN,
    },
    // ─── Navegación de semana ───
    weekNav: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.sm,
    },
    navArrow: {
      width: TOUCH.min,
      height: TOUCH.min,
      borderRadius: SHAPE.full,
      justifyContent: 'center',
      alignItems: 'center',
    },
    weekLabel: {
      flex: 1,
    },
    // ─── Tira de días ───
    dayStrip: {
      flexDirection: 'row',
      gap: SPACING.xs,
      paddingHorizontal: SCREEN_MARGIN,
      paddingTop: SPACING.sm,
      paddingBottom: SPACING.lg,
    },
    dayCell: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: TOUCH.min + 8,
      paddingVertical: SPACING.sm,
      borderRadius: SHAPE.medium,
    },
    dots: {
      flexDirection: 'row',
      gap: 3,
      height: 8,
      marginTop: SPACING.xs,
      alignItems: 'center',
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    // ─── Resumen ───
    summary: {
      padding: SPACING.lg,
      marginBottom: SPACING.xl,
    },
    summaryRow: {
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
    // ─── Día ───
    dayHeader: {
      marginBottom: SPACING.md,
    },
    timeline: {
      paddingHorizontal: SPACING.lg,
      paddingBottom: SPACING.sm,
    },
    timeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      marginTop: SPACING.lg,
      marginBottom: SPACING.xs,
    },
    timeRule: {
      flex: 1,
      height: 1,
    },
    entryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.lg,
      minHeight: TOUCH.min,
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.sm,
      marginHorizontal: -SPACING.sm,
      borderRadius: SHAPE.medium,
    },
    entryInfo: {
      flex: 1,
    },
    emptyDay: {
      alignItems: 'center',
      paddingVertical: SPACING.xxl,
    },
    emptyTitle: {
      marginTop: SPACING.md,
      marginBottom: SPACING.xs,
    },
    // ─── Leyenda ───
    legend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.lg,
      marginTop: SPACING.xl,
    },
    // ─── Volver a hoy ───
    todayButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      minHeight: TOUCH.min,
      borderRadius: SHAPE.full,
      borderWidth: 1,
      marginTop: SPACING.xxl,
    },
  });
