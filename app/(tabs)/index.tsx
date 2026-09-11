import DonMemo, { MemoGesture } from '@/components/DonMemo';
import { useFeedback } from '@/components/Feedback';
import MedicationPhoto from '@/components/MedicationPhoto';
import PatientBanner from '@/components/PatientBanner';
import TreatmentEndedCard from '@/components/TreatmentEndedCard';
import Button from '@/components/ui/Button';
import IconBadge from '@/components/ui/IconBadge';
import Surface from '@/components/ui/Surface';
import Text from '@/components/ui/Text';
import { useAuth } from '@/context/AuthContext';
import { useCaregiver } from '@/context/CaregiverContext';
import { useTheme, useThemedStyles } from '@/context/ThemeContext';
import { isConfirmed, markConfirmed, removeFromQueue } from '@/lib/alarmQueue';
import { reconcileDoseRecords, saveDoseTakenWithRetry } from '@/lib/doseSync';

import {
    cancelAllMedicationNotifications,
    cancelPersistentAlarm,
    renewMedicationNotificationsIfNeeded,
    scheduleMedicationNotifications,
    scheduleNativeAlarms,
} from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import {
    ColorScheme,
    MOTION,
    SCREEN_MARGIN,
    SHAPE,
    SPACING,
    TOUCH,
} from '@/lib/theme';
import { Medication } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
    Easing,
    FadeInDown,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';

// ─────────────────────────────────────────────────────────────────────────────
// Inicio — el pastillero abierto.
//
// Una sola jerarquía, de arriba abajo:
//
//   0. SALUDO — avatar, nombre y fecha van integrados AL CONTENIDO (se desplazan
//      con la lista), no en una barra superior fija. Es lo primero que se lee al
//      abrir, pero no le roba espacio permanente a los medicamentos.
//   1. LO QUE HAY QUE HACER AHORA — un bloque a escala de display con un solo
//      botón de ancho completo. Lo más grande de la pantalla.
//   2. LO QUE ESTÁ PENDIENTE — filas, no tarjetas, porque son variaciones de lo
//      mismo y no merecen contenedor propio.
//   3. TU MEDICAMENTO — la lista, cada renglón un compartimento con su foto.
//   4. AGREGAR — la acción de alta vive como tarjeta punteada al pie de la lista
//      (una sola acción de "agregar", sin FAB que compita).
// ─────────────────────────────────────────────────────────────────────────────

// Aire al final de la lista para que el último elemento no quede pegado a la
// barra de navegación.
const LIST_BOTTOM_PADDING = SPACING.xxl;

export default function HomeScreen() {
  const { user } = useAuth();
  const { activePatientId, isViewingOther } = useCaregiver();
  const { scheme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { snack } = useFeedback();

  const [medications, setMedications] = useState<Medication[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  // Gesto de Don Memo en el saludo: saluda al abrir, asiente al confirmar una
  // dosis. `key` sube para poder repetir el mismo gesto dos veces seguidas.
  const [memo, setMemo] = useState<{ gesture: MemoGesture; key: number }>({
    gesture: 'greet',
    key: 0,
  });
  const [, forceUpdate] = useState(0); // Para refrescar el countdown
  const [takenDoses, setTakenDoses] = useState<Set<string>>(new Set()); // Dosis ya tomadas (ocultar tarjeta urgente)
  const [confirmedDoseKeys, setConfirmedDoseKeys] = useState<Set<string>>(new Set()); // Igual, pero desde Supabase (sobrevive a cerrar la app)
  const [expiredTreatment, setExpiredTreatment] = useState<{ medication: Medication; total: number; taken: number } | null>(null);
  const [resolvingTreatment, setResolvingTreatment] = useState(false);

  // Único momento de movimiento autorado de la pantalla: la dosis vencida sin
  // confirmar respira. No es decoración — es la diferencia entre "en 40 min" y
  // "esto ya debió pasar", y se apaga en cuanto deja de estar vencida.
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.04, { duration: 900, easing: Easing.bezier(...MOTION.easing.standard) }),
        withTiming(1, { duration: 900, easing: Easing.bezier(...MOTION.easing.standard) })
      ),
      -1,
      true
    );
  }, []);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  // Auto-refresh del countdown cada 10 segundos
  useEffect(() => {
    const timer = setInterval(() => {
      forceUpdate((n) => n + 1);
    }, 10_000);
    return () => clearInterval(timer);
  }, []);

  const fetchMedications = async (): Promise<Medication[]> => {
    if (!activePatientId) return [];
    const { data, error } = await supabase
      .from('medications')
      .select('*')
      .eq('user_id', activePatientId)
      .eq('active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching medications:', error);
      setLoading(false);
      return [];
    }
    setMedications(data ?? []);
    setLoading(false);
    return data ?? [];
  };

  // Las notificaciones locales solo cubren una ventana de 7 días hacia
  // adelante (computeDoseDates) — nada las volvía a programar, así que un
  // medicamento "para siempre" dejaba de sonar en silencio a la semana de
  // creado. Aquí se revisa cada medicamento activo cada vez que se abre
  // Inicio y se extiende la ventana si ya casi se acaba (ver
  // renewMedicationNotificationsIfNeeded). Solo aplica en el propio
  // teléfono: en modo cuidador estas notificaciones no existen aquí.
  const renewNotificationWindows = async (meds: Medication[]) => {
    for (const med of meds) {
      try {
        const newIds = await renewMedicationNotificationsIfNeeded(med);
        if (newIds) {
          await supabase.from('medications').update({ notification_ids: newIds }).eq('id', med.id);
        }
      } catch (e) {
        console.log('Error renovando notificaciones de', med.name, e);
      }

      // La alarma nativa del Reloj solo se crea en el dispositivo donde se
      // hizo el alta/edición (add.tsx / details/[id].tsx), gateado por
      // `!isViewingOther` — si un cuidador agrega el medicamento desde su
      // propio teléfono, `has_native_alarm` queda en false para siempre,
      // porque el paciente normalmente nunca vuelve a "editar" un medicamento
      // que ya quedó bien configurado. El aviso que ve el cuidador al
      // guardar promete que "se programa el sonido" en cuanto el paciente
      // abra la app — esto cumple esa promesa también para la alarma nativa,
      // no solo para las notificaciones locales.
      if (med.regimen_type === 'indefinido' && !med.has_native_alarm) {
        try {
          const alarmResult = await scheduleNativeAlarms(med);
          if (alarmResult.succeeded > 0) {
            await supabase.from('medications').update({ has_native_alarm: true }).eq('id', med.id);
          }
        } catch (e) {
          console.log('Error creando alarma nativa pendiente de', med.name, e);
        }
      }
    }
  };

  // Dosis confirmadas en las últimas 24h — para saber si ya se tomó aunque
  // la app se haya cerrado y vuelto a abrir (la confirmación pudo haber
  // pasado desde una notificación, sin pasar por el estado local en memoria)
  const fetchConfirmedDoses = async () => {
    if (!activePatientId) return;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('dose_records')
      .select('medication_id, scheduled_at')
      .eq('user_id', activePatientId)
      .eq('taken', true)
      .gte('scheduled_at', since);
    if (data) {
      // OJO: Postgres devuelve scheduled_at como "...+00:00" (sin
      // milisegundos forzados); el resto de la app compara contra
      // `.toISOString()` que siempre termina en ".000Z" — como texto NUNCA
      // coinciden aunque sean el mismo instante. Por eso una dosis
      // confirmada podía seguir apareciendo como pendiente para siempre al
      // reabrir la app. Se normaliza pasando la fecha por `new Date()` antes
      // de armar la clave, así ambos lados quedan en el mismo formato.
      setConfirmedDoseKeys(new Set(data.map((d) => `${d.medication_id}_${new Date(d.scheduled_at).toISOString()}`)));
    }
  };

  // Detecta el primer tratamiento "por unos días" cuyo end_date ya pasó y
  // sigue activo — en vez de dejar que las notificaciones se apaguen en
  // silencio, se le da un cierre explícito (ver TreatmentEndedCard). Solo se
  // muestra uno a la vez para no saturar; al resolverlo aparece el
  // siguiente en el próximo refresco. Depende de que reconcileDoseRecords ya
  // haya corrido, para que el conteo de dosis tomadas esté al día.
  const fetchExpiredTreatments = async () => {
    if (!activePatientId) return;
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from('medications')
      .select('*')
      .eq('user_id', activePatientId)
      .eq('active', true)
      .eq('regimen_type', 'por_tiempo')
      .not('end_date', 'is', null)
      .lte('end_date', today);

    const trulyExpired = (data ?? []).filter(
      (m) => new Date(`${m.end_date}T23:59:59`).getTime() <= Date.now()
    );

    if (trulyExpired.length === 0) {
      setExpiredTreatment(null);
      return;
    }

    const med = trulyExpired[0] as Medication;
    const [{ count: total }, { count: taken }] = await Promise.all([
      supabase.from('dose_records').select('id', { count: 'exact', head: true }).eq('medication_id', med.id),
      supabase.from('dose_records').select('id', { count: 'exact', head: true }).eq('medication_id', med.id).eq('taken', true),
    ]);

    setExpiredTreatment({ medication: med, total: total ?? 0, taken: taken ?? 0 });
  };

  // ─── "Ya terminé": cierra el tratamiento (soft delete) y cancela sus notificaciones ───
  const handleFinishTreatment = async () => {
    if (!expiredTreatment) return;
    setResolvingTreatment(true);
    const med = expiredTreatment.medication;
    await cancelAllMedicationNotifications(med.id);
    const { error } = await supabase.from('medications').update({ active: false }).eq('id', med.id);
    setResolvingTreatment(false);
    if (error) {
      snack('No se pudo cerrar el tratamiento. Revisa tu conexión.', { tone: 'error' });
      return;
    }
    setExpiredTreatment(null);
    snack(`${med.name} quedó cerrado.`, { tone: 'success' });
    fetchMedications();
    fetchExpiredTreatments();
  };

  // ─── "El doctor lo extendió": suma días al final y reprograma ───
  const handleExtendTreatment = async (extraDays: number) => {
    if (!expiredTreatment) return;
    setResolvingTreatment(true);
    const med = expiredTreatment.medication;

    const newEnd = med.end_date ? new Date(`${med.end_date}T00:00:00`) : new Date();
    newEnd.setDate(newEnd.getDate() + extraDays);
    const newEndDate = newEnd.toISOString().slice(0, 10);
    const newDurationDays = (med.duration_days ?? 0) + extraDays;

    const { data, error } = await supabase
      .from('medications')
      .update({ duration_days: newDurationDays, end_date: newEndDate })
      .eq('id', med.id)
      .select()
      .single();

    if (error || !data) {
      setResolvingTreatment(false);
      snack('No se pudo extender el tratamiento. Revisa tu conexión.', { tone: 'error' });
      return;
    }

    // Reprogramar notificaciones locales — solo tiene sentido en el propio
    // teléfono (ver el mismo patrón en add.tsx / details/[id].tsx).
    if (!isViewingOther) {
      await cancelAllMedicationNotifications(data.id);
      const newIds = await scheduleMedicationNotifications(data);
      await supabase.from('medications').update({ notification_ids: newIds }).eq('id', data.id);
    }

    setResolvingTreatment(false);
    setExpiredTreatment(null);
    snack(`${med.name} se extendió ${extraDays} días más.`, { tone: 'success' });
    fetchMedications();
    fetchExpiredTreatments();
  };

  useFocusEffect(
    useCallback(() => {
      if (!activePatientId) return;
      fetchConfirmedDoses();
      const reconciled = reconcileDoseRecords(activePatientId).catch((e) =>
        console.log('Error reconciliando dosis:', e)
      );
      fetchMedications().then((meds) => {
        if (!isViewingOther) renewNotificationWindows(meds);
      });
      reconciled.then(() => fetchExpiredTreatments());
    }, [activePatientId, isViewingOther])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMedications();
    setRefreshing(false);
  };

  // ─── Calcula la próxima dosis como Date ───
  const getNextDoseDate = (med: Medication): Date => {
    const [h, m] = med.start_time.split(':').map(Number);
    const now = new Date();
    const today = new Date();
    today.setHours(h, m, 0, 0);

    let next = new Date(today);
    // Usar < en vez de <= para que al momento exacto de la dosis aún se muestre
    while (next.getTime() < now.getTime() - 30_000) {
      next = new Date(next.getTime() + med.frequency_hours * 60 * 60 * 1000);
    }
    return next;
  };

  // ─── Calcula la dosis más reciente (puede estar en el pasado) ───
  const getMostRecentDoseDate = (med: Medication): Date => {
    const [h, m] = med.start_time.split(':').map(Number);
    const now = new Date();
    const today = new Date();
    today.setHours(h, m, 0, 0);

    let dose = new Date(today);
    // Avanzar hasta pasar el momento actual
    while (dose <= now) {
      dose = new Date(dose.getTime() + med.frequency_hours * 60 * 60 * 1000);
    }
    // Retroceder una frecuencia para obtener la dosis más reciente (pasada o justo ahora)
    return new Date(dose.getTime() - med.frequency_hours * 60 * 60 * 1000);
  };

  const formatTime = (date: Date): string => {
    const hh = date.getHours().toString().padStart(2, '0');
    const mm = date.getMinutes().toString().padStart(2, '0');
    return `${hh}:${mm}`;
  };

  // ─── Encuentra TODOS los medicamentos con una toma pendiente de confirmar
  // o una próxima toma cercana (< 1 hora) ───
  // Antes solo se devolvía el más cercano (`closest`), así que si dos
  // medicamentos estaban pendientes de confirmar al mismo tiempo, el
  // segundo quedaba invisible — solo aparecía la tarjeta del primero. Ahora
  // se devuelven todos, con los pendientes de confirmar primero (quedan
  // visibles hasta que se confirmen, sin importar cuánto tiempo pase, para
  // no depender de que la abuela recuerde volver a la app justo a tiempo).
  const getUrgentMedications = (): { med: Medication; nextDose: Date; minutesLeft: number; overdue: boolean; pendingConfirm: boolean }[] => {
    if (medications.length === 0) return [];
    const now = new Date();
    const entries: { med: Medication; nextDose: Date; minutesLeft: number; overdue: boolean; pendingConfirm: boolean }[] = [];

    for (const med of medications) {
      // Verificar si hay una dosis pasada aún sin confirmar (se mantiene
      // visible hasta que llegue la siguiente toma programada)
      const recentDose = getMostRecentDoseDate(med);
      const nextDose = getNextDoseDate(med);
      const recentKey = `${med.id}_${recentDose.toISOString()}`;
      const recentHandled =
        takenDoses.has(recentKey) ||
        confirmedDoseKeys.has(recentKey) ||
        isConfirmed({ medicationId: med.id, scheduledAt: recentDose.toISOString() });

      if (!recentHandled && now.getTime() >= recentDose.getTime() && now.getTime() < nextDose.getTime()) {
        const minutesSince = Math.round((now.getTime() - recentDose.getTime()) / 60000);
        entries.push({ med, nextDose: recentDose, minutesLeft: 0, overdue: minutesSince > 15, pendingConfirm: true });
        continue;
      }

      // Saltar si esta dosis ya fue marcada como tomada
      const nextKey = `${med.id}_${nextDose.toISOString()}`;
      if (takenDoses.has(nextKey)) continue;
      const minutesLeft = Math.round((nextDose.getTime() - now.getTime()) / 60000);
      if (minutesLeft <= 60 && minutesLeft >= 0) {
        entries.push({ med, nextDose, minutesLeft, overdue: false, pendingConfirm: false });
      }
    }

    // Pendientes de confirmar primero (más urgentes), luego por cercanía
    entries.sort((a, b) => {
      if (a.pendingConfirm !== b.pendingConfirm) return a.pendingConfirm ? -1 : 1;
      return a.minutesLeft - b.minutesLeft;
    });
    return entries;
  };

  // ─── Marcar dosis como tomada ───
  // Optimista: se refleja de inmediato en pantalla y solo después se
  // sincroniza con Supabase en segundo plano (con reintentos) — así una red
  // lenta nunca deja el botón "pegado" ni bloquea el resto de la app (mismo
  // patrón que handleStopAlarm en alarm.tsx).
  const handleMarkTaken = async (med: Medication) => {
    if (!user) return;
    // Usamos med.user_id (el dueño real del medicamento) en vez de activePatientId
    // directamente, por si el contexto cambia mientras esta operación está en curso.

    // Calcular qué dosis estamos marcando: si "ahora" cae dentro de la ventana
    // de la dosis más reciente (aún no llega la siguiente), es esa la que se
    // está confirmando — sin importar cuántos minutos hayan pasado.
    const recentDose = getMostRecentDoseDate(med);
    const nextDose = getNextDoseDate(med);
    const now = new Date();
    const scheduledDose =
      now.getTime() >= recentDose.getTime() && now.getTime() < nextDose.getTime() ? recentDose : nextDose;

    // Cancelar notificaciones del sistema
    Notifications.dismissAllNotificationsAsync().catch(() => {});

    // Cancelar recordatorios persistentes de ESTA dosis específica.
    // OJO: antes esto además cancelaba TODO el array `med.notification_ids`
    // (las notificaciones de las próximas dosis de la semana, no solo esta),
    // así que confirmar la toma de las 8am podía dejar muda la de las 4pm.
    // cancelPersistentAlarm ya filtra por scheduledAt, así que basta con esto.
    cancelPersistentAlarm(med.id, scheduledDose.toISOString()).catch(() => {});

    // Si esta dosis también estaba esperando en la pantalla de alarma
    // (lib/alarmQueue.ts), quitarla de ahí para que no se vuelva a mostrar.
    const queueItem = { medicationId: med.id, scheduledAt: scheduledDose.toISOString() };
    removeFromQueue(queueItem);
    markConfirmed(queueItem);

    // Reflejar de inmediato en pantalla, sin esperar a la red
    const doseKey = `${med.id}_${scheduledDose.toISOString()}`;
    setTakenDoses((prev) => new Set(prev).add(doseKey));

    // Don Memo asiente. Es el acuse de recibo silencioso: el snackbar dice el
    // dato, él solo confirma que lo vio.
    setMemo((m) => ({ gesture: 'nod', key: m.key + 1 }));

    // Antes esto era un modal con botón "OK": una ventana que hay que cerrar
    // para confirmar algo que ya pasó. Ahora es un snackbar — no interrumpe, no
    // hay nada que decidir, y desaparece solo.
    snack(`${med.name}: dosis registrada.`, { tone: 'success' });

    // Guardado real en segundo plano — con reintentos por si la red falla
    const persist = async () => {
      const ok = await saveDoseTakenWithRetry(med.user_id, med.id, scheduledDose.toISOString());
      if (!ok) {
        snack(
          `${med.name} quedó marcada en el teléfono, pero no se guardó en el servidor.`,
          { tone: 'error', action: { label: 'Reintentar', onPress: persist } }
        );
      }
    };
    await persist();

    fetchMedications();
    fetchConfirmedDoses();
  };

  // La alarma la maneja _layout.tsx → navega a /alarm automáticamente
  // cuando llega una notificación de tipo ALARM.

  const fullName = typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name.trim() : '';
  const userName = fullName.split(' ')[0] || user?.email?.split('@')[0] || 'Usuario';

  const today = new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const urgentList = getUrgentMedications();

  // Medicamentos que pasaron de "para siempre" a "por unos días" y pueden
  // tener una alarma vieja en el Reloj que la app no puede borrar sola.
  // Se muestra un banner persistente hasta que el usuario confirme haberla
  // borrado desde la pantalla de detalle (ver details/[id].tsx).
  const pendingAlarmCleanup = medications.filter((m) => m.native_alarm_cleanup_pending);

  // ─── La tarjeta de dosis: un compartimento del pastillero ───
  const renderMedication = ({ item, index }: { item: Medication; index: number }) => {
    const nextDose = getNextDoseDate(item);
    return (
      <Animated.View entering={FadeInDown.delay(Math.min(index, 5) * 50).duration(MOTION.duration.long)}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${item.name}, ${item.dose_mg} miligramos. Próxima toma a las ${formatTime(nextDose)}.`}
          accessibilityHint="Abre el detalle para editar o eliminar"
          onPress={() => router.push({ pathname: '/details/[id]', params: { id: item.id } })}
          style={({ pressed }) => [pressed && styles.cardPressed]}
        >
          <Surface level={1} style={styles.doseCard}>
            <MedicationPhoto
              source={item.photo_url}
              style={styles.medImage}
              fallback={
                <View style={styles.medImagePlaceholder}>
                  <Ionicons name="medical" size={34} color={scheme.tertiary} />
                </View>
              }
            />

            <View style={styles.medInfo}>
              <Text variant="titleMedium" numberOfLines={2}>
                {item.name}
              </Text>
              <Text variant="bodySmall" tone="variant">
                {item.dose_mg} mg · cada {item.frequency_hours} h
              </Text>
              <View style={styles.nextChip}>
                <Ionicons name="alarm-outline" size={16} color={scheme.onPrimaryContainer} />
                <Text variant="labelMedium" color={scheme.onPrimaryContainer}>
                  Próxima {formatTime(nextDose)}
                </Text>
              </View>
            </View>

            <Ionicons name="chevron-forward" size={26} color={scheme.onSurfaceVariant} />
          </Surface>
        </Pressable>
      </Animated.View>
    );
  };

  // Estado vacío: el único momento de la app donde no hay ningún dato que
  // mostrar, y por lo tanto el lugar natural de Don Memo. Aquí sí habla en
  // primera persona — no está diciendo nada médico, está presentándose.
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <DonMemo size={110} gesture="greet" style={styles.emptyMemo} />
      <Text variant="headlineSmall" center style={styles.emptyTitle}>
        Mucho gusto, soy Don Memo
      </Text>
      <Text variant="bodyLarge" tone="variant" center style={styles.emptyText}>
        A mí no se me olvida nada. Dime qué medicina tomas y a qué hora, y yo me
        encargo de que suene — aunque la app esté cerrada.
      </Text>
      <Button
        title="Agregar mi primer medicamento"
        icon="add"
        emphasis
        onPress={() => router.push('/add')}
      />
    </View>
  );

  // ─── Bloque 1: lo que hay que hacer AHORA ───
  const renderUrgentHero = () => {
    if (urgentList.length === 0) return null;
    const first = urgentList[0];
    const isNow = first.minutesLeft === 0;

    const statusLabel = first.minutesLeft > 0
      ? first.minutesLeft === 1 ? 'En menos de 1 minuto' : `En ${first.minutesLeft} minutos`
      : first.overdue ? 'Pendiente de confirmar' : 'Es ahora';

    return (
      <Animated.View entering={FadeInDown.duration(MOTION.duration.long)}>
        <Surface
          level={1}
          padded
          shape="extraLarge"
          borderColor={isNow ? scheme.warning : scheme.outlineVariant}
          style={styles.hero}
        >
          {/* Eco del arte lineal del prototipo: una cápsula tenue integrada a la
              textura de la tarjeta, sin robar contraste al contenido. */}
          <Ionicons
            name="medical"
            size={120}
            color={scheme.primary}
            style={styles.heroArt}
          />
          <Animated.View
            style={[
              styles.heroBadge,
              { backgroundColor: isNow ? scheme.warningContainer : scheme.primaryContainer },
              first.overdue && pulseStyle,
            ]}
          >
            <Ionicons
              name={isNow ? 'alarm' : 'time-outline'}
              size={22}
              color={isNow ? scheme.onWarningContainer : scheme.onPrimaryContainer}
            />
            <Text
              variant="labelMedium"
              tone={isNow ? 'onWarningContainer' : 'onPrimaryContainer'}
            >
              {statusLabel}
            </Text>
          </Animated.View>

          <Text variant="displaySmall" style={styles.heroName} numberOfLines={2}>
            {first.med.name}
          </Text>
          <Text variant="titleMedium" tone="variant" style={styles.heroDose}>
            {first.med.dose_mg} mg · {formatTime(first.nextDose)}
          </Text>

          <Button
            title="Ya la tomé"
            icon="checkmark-circle"
            emphasis
            onPress={() => handleMarkTaken(first.med)}
            accessibilityHint={`Registra la dosis de ${first.med.name} como tomada`}
          />
        </Surface>
      </Animated.View>
    );
  };

  // ─── Bloque 2: el resto de pendientes, como filas ───
  // El botón va DEBAJO del texto, no al lado. Puesto al lado, un nombre de
  // medicamento largo y un rótulo como "Pendiente de confirmar" se reparten
  // ~115dp de ancho en un teléfono normal y terminan partidos en cuatro
  // renglones. Apilado, el texto tiene el ancho completo y el botón también.
  const renderOtherPending = () =>
    urgentList.slice(1).map((entry) => (
      <View
        key={`${entry.med.id}_${entry.nextDose.toISOString()}`}
        style={[styles.pendingRow, { backgroundColor: scheme.surfaceContainer }]}
      >
        <View style={styles.pendingHeader}>
          <Ionicons
            name="alarm-outline"
            size={26}
            color={entry.pendingConfirm ? scheme.warning : scheme.primary}
          />
          <View style={styles.pendingInfo}>
            <Text variant="titleSmall" numberOfLines={2}>
              {entry.med.name}
            </Text>
            <Text variant="bodySmall" tone="variant">
              {entry.med.dose_mg} mg ·{' '}
              {entry.pendingConfirm ? 'pendiente de confirmar' : `en ${entry.minutesLeft} min`}
            </Text>
          </View>
        </View>
        <Button
          title="Ya la tomé"
          icon="checkmark-circle"
          variant="tonal"
          onPress={() => handleMarkTaken(entry.med)}
          style={styles.pendingButton}
        />
      </View>
    ));

  // ─── Saludo integrado al contenido (reemplaza la barra superior fija) ───
  const renderGreeting = () => (
    <View style={[styles.greeting, { paddingTop: insets.top + SPACING.sm }]}>
      {/* Don Memo vive aquí, en el hueco donde antes había un ícono genérico
          de "persona". No es adorno flotante: es una ranura fija —la del
          avatar— y además le da al asentimiento un lugar donde caer cuando
          confirmas una dosis. */}
      <DonMemo size={44} variant="head" gesture={memo.gesture} gestureKey={memo.key} />
      <View style={styles.greetingText}>
        <Text variant="headlineSmall" numberOfLines={1}>
          Hola, {userName}
        </Text>
        <Text variant="bodyMedium" tone="variant" numberOfLines={1} style={styles.greetingDate}>
          {today}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Permisos de notificaciones"
        accessibilityHint="Abre la guía para revisar los permisos de alarma y notificación"
        onPress={() => router.push('/permissions-guide')}
        style={({ pressed }) => [
          styles.bellButton,
          { backgroundColor: scheme.surfaceContainer, borderColor: scheme.outlineVariant },
          pressed && styles.cardPressed,
        ]}
      >
        <Ionicons name="notifications-outline" size={24} color={scheme.onSurfaceVariant} />
      </Pressable>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.headerBlock}>
      {renderGreeting()}

      {expiredTreatment && (
        <TreatmentEndedCard
          medication={expiredTreatment.medication}
          total={expiredTreatment.total}
          taken={expiredTreatment.taken}
          onFinish={handleFinishTreatment}
          onExtend={handleExtendTreatment}
          loading={resolvingTreatment}
        />
      )}

      {/* Pendiente persistente: alarma vieja del Reloj sin borrar */}
      {pendingAlarmCleanup.length > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pendiente: borrar una alarma vieja del Reloj"
          onPress={() => router.push({ pathname: '/details/[id]', params: { id: pendingAlarmCleanup[0].id } })}
          style={({ pressed }) => [
            styles.cleanupBanner,
            { backgroundColor: scheme.warningContainer },
            pressed && styles.cardPressed,
          ]}
        >
          <Ionicons name="warning" size={26} color={scheme.onWarningContainer} />
          <Text variant="bodySmall" tone="onWarningContainer" style={styles.cleanupText}>
            {pendingAlarmCleanup.length === 1
              ? `Falta borrar la alarma del Reloj de ${pendingAlarmCleanup[0].name}`
              : `Faltan borrar ${pendingAlarmCleanup.length} alarmas viejas del Reloj`}
          </Text>
          <Ionicons name="chevron-forward" size={24} color={scheme.onWarningContainer} />
        </Pressable>
      )}

      {medications.length > 0 && (
        <Text variant="labelMedium" tone="variant" style={styles.sectionHeader}>
          {medications.length === 1
            ? 'TU MEDICAMENTO'
            : `TUS ${medications.length} MEDICAMENTOS`}
        </Text>
      )}
    </View>
  );

  // ─── Pie de lista: alta de medicamento + lo que toca ahora ───
  // La acción de "agregar" es una sola en toda la app y vive aquí, como tarjeta
  // punteada de invitación, en vez de un FAB flotante.
  //
  // Debajo va el bloque de "ahora". Antes abría la pantalla; ahora la cierra,
  // por decisión explícita del cliente: quiere ver primero SU lista de
  // medicamentos y dejar la confirmación al final.
  const renderFooter = () => {
    if (medications.length === 0) return null;
    return (
      <View style={styles.footerBlock}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Agregar medicamento"
          onPress={() => router.push('/add')}
          style={({ pressed }) => [
            styles.addCard,
            { borderColor: scheme.primary },
            pressed && styles.cardPressed,
          ]}
        >
          <IconBadge
            name="add"
            color={scheme.onPrimaryContainer}
            backgroundColor={scheme.primaryContainer}
            size={40}
            iconSize={24}
          />
          <Text variant="titleSmall" tone="primary">
            Agregar medicamento
          </Text>
        </Pressable>

        <View style={styles.nowBlock}>
          {renderUrgentHero()}
          {renderOtherPending()}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <PatientBanner />

      <FlatList
        data={medications}
        keyExtractor={(item) => item.id}
        renderItem={renderMedication}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={!loading ? renderEmpty : null}
        contentContainerStyle={[
          medications.length === 0 ? styles.emptyList : styles.list,
          { paddingBottom: LIST_BOTTOM_PADDING },
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
      />
    </View>
  );
}

const makeStyles = (t: ColorScheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.background,
    },
    list: {
      paddingHorizontal: SCREEN_MARGIN,
    },
    emptyList: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: SCREEN_MARGIN,
    },
    headerBlock: {
      paddingTop: 0,
    },
    cardPressed: {
      opacity: 0.85,
    },
    // ─── Bloque 0: saludo integrado ───
    greeting: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      marginBottom: SPACING.xl,
    },
    greetingText: {
      flex: 1,
    },
    greetingDate: {
      marginTop: 2,
      textTransform: 'capitalize',
    },
    bellButton: {
      width: 52,
      height: 52,
      borderRadius: SHAPE.large,
      borderWidth: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    // ─── Bloque 1: lo que hay que hacer ahora ───
    hero: {
      marginBottom: SPACING.lg,
      alignItems: 'flex-start',
      overflow: 'hidden',
    },
    heroArt: {
      position: 'absolute',
      top: -22,
      right: -18,
      opacity: 0.06,
      transform: [{ rotate: '-12deg' }],
    },
    heroBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      alignSelf: 'flex-start',
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm,
      borderRadius: SHAPE.full,
      marginBottom: SPACING.lg,
    },
    heroName: {
      marginBottom: SPACING.xs,
    },
    heroDose: {
      marginBottom: SPACING.xl,
    },
    // ─── Bloque 2: pendientes adicionales ───
    pendingRow: {
      borderRadius: SHAPE.medium,
      padding: SPACING.lg,
      marginBottom: SPACING.sm,
    },
    pendingHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
    },
    pendingInfo: {
      flex: 1,
    },
    pendingButton: {
      marginTop: SPACING.md,
    },
    // ─── Pendiente del Reloj ───
    cleanupBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      borderRadius: SHAPE.medium,
      padding: SPACING.lg,
      marginTop: SPACING.sm,
      minHeight: TOUCH.min,
    },
    cleanupText: {
      flex: 1,
    },
    // ─── Encabezado de sección ───
    sectionHeader: {
      marginTop: SPACING.xxl,
      marginBottom: SPACING.md,
    },
    // ─── Compartimento ───
    doseCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.lg,
      padding: SPACING.lg,
      marginBottom: SPACING.md,
    },
    medImage: {
      width: 72,
      height: 72,
      borderRadius: SHAPE.medium,
    },
    medImagePlaceholder: {
      width: 72,
      height: 72,
      borderRadius: SHAPE.medium,
      backgroundColor: t.tertiaryContainer,
      justifyContent: 'center',
      alignItems: 'center',
    },
    medInfo: {
      flex: 1,
    },
    nextChip: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: SPACING.xs,
      backgroundColor: t.primaryContainer,
      borderRadius: SHAPE.full,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs,
      marginTop: SPACING.sm,
    },
    // ─── Estado vacío ───
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: SPACING.xxxl,
    },
    emptyMemo: {
      marginBottom: SPACING.xs,
    },
    emptyTitle: {
      marginTop: SPACING.xl,
    },
    emptyText: {
      marginTop: SPACING.md,
      marginBottom: SPACING.xxl,
    },
    // ─── Pie de lista: alta ───
    footerBlock: {
      marginTop: SPACING.lg,
      gap: SPACING.md,
    },
    // Aire extra antes del bloque de "ahora": pegado a la tarjeta punteada de
    // "agregar" se leerían como un mismo grupo, y no lo son.
    nowBlock: {
      marginTop: SPACING.xl,
      gap: SPACING.md,
    },
    addCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.md,
      minHeight: TOUCH.min,
      borderRadius: SHAPE.large,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      paddingHorizontal: SPACING.lg,
    },
  });
