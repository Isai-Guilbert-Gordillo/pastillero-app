import { AdBanner } from '@/components/AdBanner';
import { useAuth } from '@/context/AuthContext';
import { startAlarm, stopAlarm } from '@/lib/alarm';
import { supabase } from '@/lib/supabase';
import { BORDER_RADIUS, COLORS, FONTS, SPACING, TOUCH_TARGET } from '@/lib/theme';
import { Medication } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Notifications from 'expo-notifications';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert,
    Dimensions,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    Vibration,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const SCREEN_HEIGHT = Dimensions.get('window').height;

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [alarmActive, setAlarmActive] = useState(false);
  const alarmCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMedications = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('medications')
      .select('*')
      .eq('user_id', user.id)
      .eq('active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching medications:', error);
    } else {
      setMedications(data ?? []);
    }
    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchMedications();
    }, [user])
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
    while (next <= now) {
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

  // ─── Encuentra el medicamento con la próxima toma más cercana (< 1 hora) ───
  const getUrgentMedication = (): { med: Medication; nextDose: Date; minutesLeft: number } | null => {
    if (medications.length === 0) return null;
    const now = new Date();
    let closest: { med: Medication; nextDose: Date; minutesLeft: number } | null = null;

    for (const med of medications) {
      // Verificar si la dosis reciente fue hace pocos minutos (aún urgente)
      const recentDose = getMostRecentDoseDate(med);
      const minutesSince = Math.round((now.getTime() - recentDose.getTime()) / 60000);
      if (minutesSince >= 0 && minutesSince <= 10) {
        // La dosis fue hace 0-10 minutos — es urgente
        if (!closest || minutesSince < (closest.minutesLeft === 0 ? 999 : closest.minutesLeft)) {
          closest = { med, nextDose: recentDose, minutesLeft: 0 };
        }
        continue;
      }

      // Verificar la próxima dosis futura
      const nextDose = getNextDoseDate(med);
      const minutesLeft = Math.round((nextDose.getTime() - now.getTime()) / 60000);
      if (minutesLeft <= 60 && minutesLeft >= 0) {
        if (!closest || minutesLeft < closest.minutesLeft) {
          closest = { med, nextDose, minutesLeft };
        }
      }
    }
    return closest;
  };

  // ─── Marcar dosis como tomada — FALLO SEGURO ───
  const handleMarkTaken = async (med: Medication) => {
    if (!user) return;

    // ══ PRIORIDAD 0 — Detención INMEDIATA (síncrona) ══
    Vibration.cancel();
    stopAlarm();
    Notifications.dismissAllNotificationsAsync().catch(() => {});
    setAlarmActive(false);

    // Cancelar notificaciones futuras usando IDs guardados
    if (med.notification_ids?.length) {
      for (const nid of med.notification_ids) {
        Notifications.cancelScheduledNotificationAsync(nid).catch(() => {});
      }
    }

    // ══ PRIORIDAD 1 — Guardar en Supabase (try-catch) ══
    const recentDose = getMostRecentDoseDate(med);
    const nextDose = getNextDoseDate(med);
    const now = new Date();
    const minutesSinceRecent = (now.getTime() - recentDose.getTime()) / 60000;
    const scheduledDose = minutesSinceRecent >= 0 && minutesSinceRecent <= 10 ? recentDose : nextDose;

    try {
      const { data: existing } = await supabase
        .from('dose_records')
        .select('id')
        .eq('medication_id', med.id)
        .eq('user_id', user.id)
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
          user_id: user.id,
          scheduled_at: scheduledDose.toISOString(),
          taken: true,
          responded_at: now.toISOString(),
        });
        if (error) throw error;
      }
    } catch (e) {
      console.log('Error guardando dosis:', e);
      Alert.alert(
        'Alarma detenida',
        'No se pudo guardar la dosis (¿sin internet?). Puedes registrarla desde el historial.',
        [{ text: 'OK' }, { text: 'Reintentar', onPress: () => handleMarkTaken(med) }]
      );
    }
    fetchMedications();
  };

  // ─── Alarma: verificar cada 15s si hay medicamento que toca AHORA ───
  const checkAndTriggerAlarm = useCallback(() => {
    if (medications.length === 0 || alarmActive) return;
    const now = new Date();
    
    for (const med of medications) {
      // Verificar si la dosis más reciente fue hace 0-5 minutos
      const recentDose = getMostRecentDoseDate(med);
      const minutesSince = (now.getTime() - recentDose.getTime()) / 60000;
      
      if (minutesSince >= 0 && minutesSince <= 5) {
        console.log(`¡ALARMA! ${med.name} — dosis programada hace ${Math.round(minutesSince)} min`);
        startAlarm();
        setAlarmActive(true);
        Vibration.vibrate([0, 500, 300, 500, 300, 500], true);
        return;
      }

      // También verificar si la próxima dosis es en menos de 30 segundos
      const nextDose = getNextDoseDate(med);
      const secondsUntil = (nextDose.getTime() - now.getTime()) / 1000;
      if (secondsUntil >= 0 && secondsUntil <= 30) {
        console.log(`¡ALARMA! ${med.name} — dosis en ${Math.round(secondsUntil)}s`);
        startAlarm();
        setAlarmActive(true);
        Vibration.vibrate([0, 500, 300, 500, 300, 500], true);
        return;
      }
    }
  }, [medications, alarmActive]);

  // Revisar periódicamente si es hora de la alarma (cada 15 segundos)
  useEffect(() => {
    checkAndTriggerAlarm();
    alarmCheckRef.current = setInterval(checkAndTriggerAlarm, 15000);
    return () => {
      if (alarmCheckRef.current) clearInterval(alarmCheckRef.current);
    };
  }, [checkAndTriggerAlarm]);

  // Nota: el listener de notificación recibida ahora es global en _layout.tsx
  // y navega automáticamente a /alarm.

  // ─── Limpiar alarma al desmontar ───
  useEffect(() => {
    return () => {
      Vibration.cancel();
      stopAlarm();
    };
  }, []);

  const userName = user?.email?.split('@')[0] ?? 'Usuario';

  const urgent = getUrgentMedication();

  // ─── Tarjeta de medicamento (tappable → detalle) ───
  const renderMedication = ({ item }: { item: Medication }) => {
    const nextDose = getNextDoseDate(item);
    return (
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
              <Ionicons name="time-outline" size={20} color={COLORS.primary} />
              <Text style={styles.medSchedule}>
                Cada {item.frequency_hours}h — Próxima: {formatTime(nextDose)}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={24} color={COLORS.textLight} />
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
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
    </View>
  );

  // ─── Header con lista ───
  const renderHeader = () => (
    <>
      {/* Tarjeta de Alerta Gigante — solo si hay toma próxima (< 1 hora) */}
      {urgent && (
        <View style={[styles.alertCard, alarmActive && styles.alertCardAlarm]}>
          <View style={styles.alertBadge}>
            <Ionicons name="alarm" size={22} color={COLORS.white} />
            <Text style={styles.alertBadgeText}>
              {alarmActive ? '🔔 ¡ALARMA SONANDO!' : urgent.minutesLeft <= 0 ? '¡AHORA!' : `En ${urgent.minutesLeft} min`}
            </Text>
          </View>
          <Text style={styles.alertMedName}>{urgent.med.name}</Text>
          <Text style={styles.alertMedDose}>{urgent.med.dose_mg} mg — {formatTime(urgent.nextDose)}</Text>
          <TouchableOpacity
            style={[styles.alertButton, alarmActive && styles.alertButtonAlarm]}
            onPress={() => handleMarkTaken(urgent.med)}
            activeOpacity={0.7}
          >
            <Text style={styles.alertButtonText}>
              {alarmActive ? '🔕  DETENER ALARMA — YA LA TOMÉ' : '✅  YA LA TOMÉ'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* AdMob Banner */}
      <AdBanner />

      {/* Subtítulo de lista */}
      {medications.length > 0 && (
        <Text style={styles.listTitle}>
          {medications.length} medicamento{medications.length !== 1 ? 's' : ''} activo{medications.length !== 1 ? 's' : ''}
        </Text>
      )}
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Hero Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>Hola, {userName}</Text>
          <Text style={styles.subGreeting}>Tu salud es lo primero</Text>
        </View>
        <View style={styles.headerIcon}>
          <Text style={{ fontSize: 32 }}>💊</Text>
        </View>
      </View>

      {/* Medication List */}
      <FlatList
        data={medications}
        keyExtractor={(item) => item.id}
        renderItem={renderMedication}
        ListHeaderComponent={renderHeader}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg + 4,
    borderBottomLeftRadius: BORDER_RADIUS.xl,
    borderBottomRightRadius: BORDER_RADIUS.xl,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: FONTS.sizeTitle,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  subGreeting: {
    fontSize: FONTS.sizeMedium,
    color: '#C8E6C9',
    marginTop: 4,
  },
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
    fontWeight: 'bold',
  },
  alertMedName: {
    fontSize: FONTS.sizeHero,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
  },
  alertMedDose: {
    fontSize: FONTS.sizeLarge,
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
    elevation: 3,
  },
  alertButtonText: {
    color: COLORS.white,
    fontSize: FONTS.sizeLarge,
    fontWeight: 'bold',
  },
  alertCardAlarm: {
    backgroundColor: '#FFF0F0',
    borderColor: '#D32F2F',
    borderWidth: 3,
  },
  alertButtonAlarm: {
    backgroundColor: '#D32F2F',
  },
  // ─── Lista ───
  listTitle: {
    fontSize: FONTS.sizeMedium,
    fontWeight: 'bold',
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
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
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
    fontWeight: 'bold',
    color: COLORS.text,
  },
  medDose: {
    fontSize: FONTS.sizeMedium,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  medSchedule: {
    fontSize: FONTS.sizeSmall,
    color: COLORS.primary,
    marginLeft: 6,
    fontWeight: '600',
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
    fontWeight: 'bold',
    color: COLORS.text,
  },
  emptyText: {
    fontSize: FONTS.sizeMedium,
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
  },
  emptyButtonText: {
    color: COLORS.white,
    fontSize: FONTS.sizeLarge,
    fontWeight: 'bold',
  },
});
