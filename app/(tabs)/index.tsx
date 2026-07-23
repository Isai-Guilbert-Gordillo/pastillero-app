import { AdBanner } from '@/components/AdBanner';
import { useAppAlert } from '@/components/AppAlert';
import PatientBanner from '@/components/PatientBanner';
import IconBadge from '@/components/ui/IconBadge';
import ScreenHeader from '@/components/ui/ScreenHeader';
import { useAuth } from '@/context/AuthContext';
import { useCaregiver } from '@/context/CaregiverContext';
import { reconcileDoseRecords } from '@/lib/doseSync';
import { cancelPersistentAlarm } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { BORDER_RADIUS, COLORS, FONTS, SHADOWS, SPACING, TOUCH_TARGET } from '@/lib/theme';
import { Medication } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Notifications from 'expo-notifications';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Dimensions,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
    FadeInDown,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';

const SCREEN_HEIGHT = Dimensions.get('window').height;

export default function HomeScreen() {
  const { user } = useAuth();
  const { activePatientId } = useCaregiver();
  const router = useRouter();
  const { alert } = useAppAlert();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [, forceUpdate] = useState(0); // Para refrescar el countdown
  const [takenDoses, setTakenDoses] = useState<Set<string>>(new Set()); // Dosis ya tomadas (ocultar tarjeta urgente)
  const [confirmedDoseKeys, setConfirmedDoseKeys] = useState<Set<string>>(new Set()); // Igual, pero desde Supabase (sobrevive a cerrar la app)

  // Pulso "respirando" del badge de alerta urgente
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(withTiming(1.06, { duration: 700 }), withTiming(1, { duration: 700 })),
      -1,
      true
    );
  }, []);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  // Auto-refresh del countdown cada 10 segundos
  useEffect(() => {
    const timer = setInterval(() => {
      forceUpdate(n => n + 1);
    }, 10_000);
    return () => clearInterval(timer);
  }, []);

  const fetchMedications = async () => {
    if (!activePatientId) return;
    const { data, error } = await supabase
      .from('medications')
      .select('*')
      .eq('user_id', activePatientId)
      .eq('active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching medications:', error);
    } else {
      setMedications(data ?? []);
    }
    setLoading(false);
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
      setConfirmedDoseKeys(new Set(data.map((d) => `${d.medication_id}_${d.scheduled_at}`)));
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (activePatientId) reconcileDoseRecords(activePatientId).catch((e) => console.log('Error reconciliando dosis:', e));
      fetchMedications();
      fetchConfirmedDoses();
    }, [activePatientId])
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

  // ─── Encuentra el medicamento con la próxima toma más cercana, o una toma
  // pendiente de confirmar (se queda visible hasta que se confirme, sin
  // importar cuánto tiempo pase, para no depender de que la abuela recuerde
  // volver a la app justo a tiempo) ───
  const getUrgentMedication = (): { med: Medication; nextDose: Date; minutesLeft: number; overdue: boolean } | null => {
    if (medications.length === 0) return null;
    const now = new Date();
    let closest: { med: Medication; nextDose: Date; minutesLeft: number; overdue: boolean } | null = null;

    for (const med of medications) {
      // Verificar si hay una dosis pasada aún sin confirmar (se mantiene
      // visible hasta que llegue la siguiente toma programada)
      const recentDose = getMostRecentDoseDate(med);
      const nextDose = getNextDoseDate(med);
      const recentKey = `${med.id}_${recentDose.toISOString()}`;
      const recentHandled = takenDoses.has(recentKey) || confirmedDoseKeys.has(recentKey);

      if (!recentHandled && now.getTime() >= recentDose.getTime() && now.getTime() < nextDose.getTime()) {
        const minutesSince = Math.round((now.getTime() - recentDose.getTime()) / 60000);
        if (!closest || (closest.minutesLeft === 0 && minutesSince < 999)) {
          closest = { med, nextDose: recentDose, minutesLeft: 0, overdue: minutesSince > 15 };
        }
        continue;
      }

      // Saltar si esta dosis ya fue marcada como tomada
      const nextKey = `${med.id}_${nextDose.toISOString()}`;
      if (takenDoses.has(nextKey)) continue;
      const minutesLeft = Math.round((nextDose.getTime() - now.getTime()) / 60000);
      if (minutesLeft <= 60 && minutesLeft >= 0) {
        if (!closest || minutesLeft < closest.minutesLeft) {
          closest = { med, nextDose, minutesLeft, overdue: false };
        }
      }
    }
    return closest;
  };

  // ─── Marcar dosis como tomada ───
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

    // Cancelar recordatorios persistentes de ESTA dosis específica
    cancelPersistentAlarm(med.id, scheduledDose.toISOString()).catch(() => {});

    // Cancelar notificaciones futuras usando IDs guardados
    if (med.notification_ids?.length) {
      for (const nid of med.notification_ids) {
        Notifications.cancelScheduledNotificationAsync(nid).catch(() => {});
      }
    }

    try {
      const { data: existing } = await supabase
        .from('dose_records')
        .select('id')
        .eq('medication_id', med.id)
        .eq('user_id', med.user_id)
        .eq('scheduled_at', scheduledDose.toISOString())
        .is('taken', null)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('dose_records')
          .update({ taken: true, responded_at: now.toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('dose_records').insert({
          medication_id: med.id,
          user_id: med.user_id,
          scheduled_at: scheduledDose.toISOString(),
          taken: true,
          responded_at: now.toISOString(),
        });
        if (error) throw error;
      }
    } catch (e) {
      console.log('Error guardando dosis:', e);
      alert(
        'Alarma detenida',
        'No se pudo guardar la dosis (¿sin internet?). Puedes registrarla desde el historial.',
        [{ text: 'OK' }, { text: 'Reintentar', onPress: () => handleMarkTaken(med) }]
      );
      return;
    }
    // Marcar esta dosis como tomada localmente para ocultar la tarjeta urgente de inmediato
    const doseKey = `${med.id}_${scheduledDose.toISOString()}`;
    setTakenDoses(prev => new Set(prev).add(doseKey));

    alert('✅ ¡Dosis registrada!', `${med.name} marcada como tomada.`);
    fetchMedications();
    fetchConfirmedDoses();
  };

  // La alarma la maneja _layout.tsx → navega a /alarm automáticamente
  // cuando llega una notificación de tipo ALARM.

  const fullName = typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name.trim() : '';
  const userName = fullName.split(' ')[0] || user?.email?.split('@')[0] || 'Usuario';

  const urgent = getUrgentMedication();

  // ─── Tarjeta de medicamento (tappable → detalle) ───
  const renderMedication = ({ item, index }: { item: Medication; index: number }) => {
    const nextDose = getNextDoseDate(item);
    return (
      <Animated.View entering={FadeInDown.delay(Math.min(index, 6) * 70).duration(400)}>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.7}
          onPress={() => router.push({ pathname: '/details/[id]', params: { id: item.id } })}
        >
          <View style={styles.cardContent}>
            {item.photo_url ? (
              <Image source={{ uri: item.photo_url }} style={styles.medImage} contentFit="cover" />
            ) : (
              <View style={styles.medImagePlaceholder}>
                <Text style={styles.pillEmoji}>💊</Text>
              </View>
            )}
            <View style={styles.medInfo}>
              <Text style={styles.medName} numberOfLines={2}>{item.name}</Text>
              <Text style={styles.medDose}>{item.dose_mg} mg</Text>
              <View style={styles.scheduleRow}>
                <IconBadge name="time" color={COLORS.primary} backgroundColor={COLORS.primaryBg} size={28} iconSize={16} />
                <Text style={styles.medSchedule}>
                  Cada {item.frequency_hours}h — Próxima: {formatTime(nextDose)}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={24} color={COLORS.textLight} />
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderEmpty = () => (
    <Animated.View entering={FadeInDown.duration(400)} style={styles.emptyContainer}>
      <Text style={styles.emptyEmoji}>💊</Text>
      <Text style={styles.emptyTitle}>Sin medicamentos</Text>
      <Text style={styles.emptyText}>
        Toca "Agregar" para añadir tu primer medicamento
      </Text>
      <TouchableOpacity
        style={styles.emptyButton}
        onPress={() => router.push('/(tabs)/add')}
        activeOpacity={0.7}
      >
        <Ionicons name="add-circle" size={28} color={COLORS.white} />
        <Text style={styles.emptyButtonText}>Agregar medicamento</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  // ─── Header con lista ───
  const renderHeader = () => (
    <>
      {/* Tarjeta de Alerta Gigante — solo si hay toma próxima (< 1 hora) */}
      {urgent && (
        <Animated.View entering={FadeInDown.duration(350)} style={styles.alertCard}>
          <Animated.View style={[styles.alertBadge, pulseStyle]}>
            <Ionicons name="alarm" size={22} color={COLORS.white} />
            <Text style={styles.alertBadgeText}>
              {urgent.minutesLeft > 0
                ? urgent.minutesLeft === 1 ? 'En menos de 1 min' : `En ${urgent.minutesLeft} min`
                : urgent.overdue ? 'Pendiente de confirmar' : '¡TÓMALA AHORA!'}
            </Text>
          </Animated.View>
          <Text style={styles.alertMedName}>{urgent.med.name}</Text>
          <Text style={styles.alertMedDose}>{urgent.med.dose_mg} mg — {formatTime(urgent.nextDose)}</Text>
          <TouchableOpacity
            style={styles.alertButton}
            onPress={() => handleMarkTaken(urgent.med)}
            activeOpacity={0.7}
          >
            <Text style={styles.alertButtonText}>✅  YA LA TOMÉ</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Subtítulo de lista */}
      {medications.length > 0 && (
        <Text style={styles.listTitle}>
          {medications.length} medicamento{medications.length !== 1 ? 's' : ''} activo{medications.length !== 1 ? 's' : ''}
        </Text>
      )}
    </>
  );

  // Banner de anuncios al final de la lista — lejos del botón "YA LA TOMÉ"
  // para que un toque accidental no saque a la abuela de la app en plena alarma.
  const renderFooter = () => (medications.length > 0 ? <AdBanner /> : null);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Hero Header */}
      <ScreenHeader
        title={`Hola, ${userName}`}
        subtitle="Tu salud es lo primero"
        rightElement={
          <View style={styles.headerIcon}>
            <Text style={{ fontSize: 32 }}>💊</Text>
          </View>
        }
      />
      <PatientBanner />

      {/* Medication List */}
      <FlatList
        data={medications}
        keyExtractor={(item) => item.id}
        renderItem={renderMedication}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={!loading ? renderEmpty : null}
        contentContainerStyle={medications.length === 0 ? styles.emptyList : styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  // ─── Hero Header ───
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // ─── Tarjeta de Alerta Gigante ───
  alertCard: {
    backgroundColor: COLORS.warningLight,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 2,
    borderColor: COLORS.warning,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    padding: SPACING.lg,
    minHeight: SCREEN_HEIGHT * 0.25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.warning,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    gap: 6,
    marginBottom: SPACING.md,
  },
  alertBadgeText: {
    color: COLORS.white,
    fontSize: FONTS.sizeMedium,
    fontFamily: FONTS.family.bold,
  },
  alertMedName: {
    fontSize: FONTS.sizeHero,
    fontFamily: FONTS.family.extraBold,
    color: COLORS.text,
    textAlign: 'center',
  },
  alertMedDose: {
    fontSize: FONTS.sizeLarge,
    fontFamily: FONTS.family.medium,
    color: COLORS.textSecondary,
    marginTop: 4,
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  alertButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md + 4,
    borderRadius: BORDER_RADIUS.md,
    minHeight: TOUCH_TARGET.minHeight,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    ...SHADOWS.button,
  },
  alertButtonText: {
    color: COLORS.white,
    fontSize: FONTS.sizeLarge,
    fontFamily: FONTS.family.bold,
  },
  // ─── Lista ───
  listTitle: {
    fontSize: FONTS.sizeMedium,
    fontFamily: FONTS.family.bold,
    color: COLORS.textSecondary,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  list: {
    paddingBottom: 120,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  // ─── Tarjeta de Medicamento (más grande, sin basura) ───
  card: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.card,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  medImage: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.md,
  },
  medImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primaryBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillEmoji: {
    fontSize: 38,
  },
  medInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  medName: {
    fontSize: FONTS.sizeLarge,
    fontFamily: FONTS.family.bold,
    color: COLORS.text,
  },
  medDose: {
    fontSize: FONTS.sizeMedium,
    fontFamily: FONTS.family.regular,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: SPACING.sm,
  },
  medSchedule: {
    fontSize: FONTS.sizeSmall,
    color: COLORS.primary,
    fontFamily: FONTS.family.semiBold,
  },
  // ─── Estado vacío ───
  emptyContainer: {
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyEmoji: {
    fontSize: 72,
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: FONTS.sizeLarge,
    fontFamily: FONTS.family.bold,
    color: COLORS.text,
  },
  emptyText: {
    fontSize: FONTS.sizeMedium,
    fontFamily: FONTS.family.regular,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
    lineHeight: 30,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    minHeight: TOUCH_TARGET.minHeight,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
    width: '100%',
    ...SHADOWS.button,
  },
  emptyButtonText: {
    color: COLORS.white,
    fontSize: FONTS.sizeLarge,
    fontFamily: FONTS.family.bold,
  },
});
