import { useFeedback } from '@/components/Feedback';
import MedicationPhoto from '@/components/MedicationPhoto';
import Text from '@/components/ui/Text';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { AlarmQueueItem, getAlarmQueue, markConfirmed, removeFromQueue, subscribeAlarmQueue } from '@/lib/alarmQueue';
import { saveDoseTakenWithRetry } from '@/lib/doseSync';
import { cancelPersistentAlarm, snoozeAlarm } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { MOTION, SCREEN_MARGIN, SHAPE, SPACING, TOUCH } from '@/lib/theme';
import { Medication } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Vibration,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';

// ─────────────────────────────────────────────────────────────────────────────
// La alarma — el momento del producto.
//
// La versión anterior era un degradado rojo-naranja a pantalla completa. Se
// cambió por un campo de teal de marca, y no por gusto:
//
//   · La Regla del Rojo Reservado. La alarma NO es un error: es la app haciendo
//     exactamente lo que prometió. El rojo se reserva para lo que salió mal, y
//     si todo se pinta de rojo, el rojo deja de significar algo.
//   · Un campo rojo saturado en la cara a las 3 AM es agresivo con una persona
//     de 80 años recién despertada. La urgencia ya la ponen el sonido en bucle,
//     la vibración y la escala del tipo — no hace falta gritarle con el color.
//   · Es el único lugar de la app donde el tono de marca (#0D9488) ocupa la
//     pantalla completa. Al abrir los ojos, se reconoce de qué app es antes de
//     leer una sola palabra.
//
// El único acento cálido es la píldora de "ALARMA": ámbar sobre teal, el
// contraste más alto del sistema, y el único elemento que se mueve.
// ─────────────────────────────────────────────────────────────────────────────

/** Campo de la alarma. Dos paradas del mismo tono — profundidad, no efecto. */
const FIELD_LIGHT = ['#14B8A6', '#0F766E', '#065F58'] as const;
const FIELD_DARK = ['#0B3B36', '#062A26', '#01201C'] as const;

export default function AlarmScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { snack } = useFeedback();

  // Sobre el campo de marca los colores no vienen de roles de superficie: es una
  // superficie propia, con su propio par contenido/contenedor.
  const onField = scheme.dark ? '#CCFBF1' : '#FFFFFF';
  const onFieldMuted = scheme.dark ? 'rgba(204,251,241,0.72)' : 'rgba(255,255,255,0.78)';
  const actionSurface = scheme.dark ? '#CCFBF1' : '#FFFFFF';
  const onActionSurface = scheme.dark ? '#00201C' : '#0F766E';

  // ─── Cola compartida de alarmas (lib/alarmQueue.ts) ───
  // Esta pantalla SIEMPRE muestra el primer item de la cola. Si llega un
  // segundo medicamento mientras esta pantalla ya está abierta, no se apila
  // una pantalla nueva — solo se agrega aquí y aparece "+N esperando".
  const [queue, setQueue] = useState<AlarmQueueItem[]>(() => getAlarmQueue());
  useEffect(() => subscribeAlarmQueue(() => setQueue([...getAlarmQueue()])), []);
  const current = queue[0] ?? null;
  const currentKey = current ? `${current.medicationId}_${current.scheduledAt}` : '';

  const [medication, setMedication] = useState<Medication | null>(null);
  const [loading, setLoading] = useState(true);
  const [stopping, setStopping] = useState(false);
  const [snoozing, setSnoozing] = useState(false);

  // Referencia para el sonido, para poder detenerlo síncronamente
  const soundRef = useRef<Audio.Sound | null>(null);

  // Si la cola se vacía (se confirmó/pospuso el último pendiente), salir
  useEffect(() => {
    if (!current) {
      router.replace('/(tabs)');
    }
  }, [current]);

  // Único elemento en movimiento de la pantalla. Late despacio (900 ms por
  // lado): un parpadeo rápido a las 3 AM desorienta en vez de orientar.
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 900, easing: Easing.bezier(...MOTION.easing.standard) }),
        withTiming(1, { duration: 900, easing: Easing.bezier(...MOTION.easing.standard) })
      ),
      -1,
      true
    );
  }, []);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  // Cargar datos del medicamento actual — se vuelve a ejecutar cada vez que
  // avanzamos al siguiente item de la cola
  useEffect(() => {
    let cancelled = false;
    if (!current) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setMedication(null);
    supabase
      .from('medications')
      .select('*')
      .eq('id', current.medicationId)
      .single()
      .then(({ data }) => {
        if (!cancelled) {
          setMedication(data ?? null);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [currentKey]);

  // Motor de Audio y Vibración.
  // Para medicamentos "indefinido" ya sonó (o debió sonar) la alarma nativa
  // del Reloj del teléfono — no duplicamos el sonido fuerte aquí, solo
  // vibramos suave y mostramos la pantalla para confirmar. Para "por_tiempo"
  // (sin alarma nativa) esta sigue siendo la única alarma, así que se queda
  // igual de fuerte que antes. Espera a que cargue el medicamento para saber
  // cuál modo usar, así no hay un "flash" de sonido fuerte que luego se corta.
  useEffect(() => {
    if (loading || !current) return;
    let mounted = true;
    const softMode = medication?.regimen_type === 'indefinido';

    const startAlarmEngine = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: true,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
          interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        });

        if (softMode) {
          // Vibración suave — el Reloj ya hizo el ruido fuerte
          Vibration.vibrate([0, 400, 300, 400], true);
          return;
        }

        // Vibración AGRESIVA continua — única alarma para este medicamento
        Vibration.vibrate(
          [0, 1000, 200, 1000, 200, 1000, 200, 1500, 300, 1500, 300, 1500],
          true
        );

        const { sound } = await Audio.Sound.createAsync(
          require('../assets/alarm_sound.wav'),
          {
            shouldPlay: true,
            isLooping: true,
            volume: 1.0,
            rate: 1.0,
            shouldCorrectPitch: false,
          }
        );

        if (mounted) {
          soundRef.current = sound;
        } else {
          await sound.unloadAsync();
        }
      } catch (error) {
        console.error('Error en motor de alarma:', error);
        Vibration.vibrate(
          [0, 1000, 200, 1000, 200, 1000, 200, 1500, 300, 1500, 300, 1500],
          true
        );
      }
    };

    startAlarmEngine();

    return () => {
      mounted = false;
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
      Vibration.cancel();
    };
  }, [loading, currentKey, medication?.regimen_type]);

  // ─── Detención SÍNCRONA del sonido/vibración (compartida por ambos botones) ───
  const stopSoundAndVibration = async () => {
    Vibration.cancel();
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch (e) {
        console.log('Error deteniendo audio:', e);
      }
      soundRef.current = null;
    }
    Notifications.dismissAllNotificationsAsync().catch(() => {});
  };

  // ─── Botón: Posponer 5 minutos ───
  const handleSnooze = async () => {
    if (!current || snoozing || stopping) return;
    setSnoozing(true);
    await stopSoundAndVibration();
    await snoozeAlarm(
      current.medicationId,
      { medicationId: current.medicationId, type: 'ALARM', scheduledAt: current.scheduledAt || '' },
      current.scheduledAt || undefined
    );
    // Se quita de la cola actual (sin marcarla "confirmada") — el snooze ya
    // programó una notificación nueva en 5 min que la volverá a encolar.
    removeFromQueue(current);
    setSnoozing(false);
  };

  // ─── Botón principal ───
  // Antes esta pantalla esperaba a que Supabase confirmara el guardado antes
  // de poder salir — con la red lenta o intermitente eso dejaba a la abuela
  // atorada mirando el botón sin poder hacer nada más. Ahora: se sale de
  // inmediato en cuanto se detiene el sonido y se quita de la cola; el guardado
  // corre en segundo plano con reintentos, y solo si TODOS fallan se avisa (ya
  // en Inicio, sin bloquear nada).
  const handleStopAlarm = async () => {
    if (!current || stopping) return;
    setStopping(true);
    const item = current;

    // ══ Detención SÍNCRONA (lo que percibe el usuario) ══
    await stopSoundAndVibration();

    // Cancelar TODOS los recordatorios persistentes de ESTA DOSIS (y solo esta)
    cancelPersistentAlarm(item.medicationId, item.scheduledAt || undefined).catch(() => {});

    // Salir de la cola YA — si quedan más medicamentos, la pantalla avanza
    // sola al siguiente; si no, navega a Inicio (ver el useEffect de arriba)
    removeFromQueue(item);
    markConfirmed(item);
    setStopping(false);

    // Guardado en segundo plano — no bloquea la salida de esta pantalla
    if (user) {
      const scheduledAt = item.scheduledAt || new Date().toISOString();
      saveDoseTakenWithRetry(user.id, item.medicationId, scheduledAt).then((ok) => {
        if (!ok) {
          snack(
            'La dosis quedó marcada en el teléfono, pero no se pudo guardar en el servidor.',
            { tone: 'error' }
          );
        }
      });
    }
  };

  const field = scheme.dark ? FIELD_DARK : FIELD_LIGHT;

  if (loading || !current) {
    return (
      <LinearGradient colors={field} style={styles.loading}>
        <ActivityIndicator size="large" color={onField} />
        <Text variant="bodyMedium" color={onField} style={styles.loadingText}>
          Preparando la alarma…
        </Text>
      </LinearGradient>
    );
  }

  const moreWaiting = queue.length - 1;
  const scheduledLabel = current.scheduledAt
    ? new Date(current.scheduledAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <LinearGradient colors={field} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={styles.container}>
      {/* ScrollView en vez de View fija: con letra grande o pantallas chicas el
          contenido puede no caber — antes eso dejaba "Posponer" fuera de la
          pantalla, sin forma de alcanzarlo. */}
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + SPACING.xl, paddingBottom: insets.bottom + SPACING.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Píldora de estado: el único elemento que se mueve ─── */}
        <Animated.View style={[styles.alarmChip, { backgroundColor: scheme.warningContainer }, pulseStyle]}>
          <Ionicons name="alarm" size={26} color={scheme.onWarningContainer} />
          <Text variant="labelLarge" tone="onWarningContainer">
            ES HORA DE TU MEDICINA
          </Text>
        </Animated.View>

        {/* ─── El medicamento, a escala de display ─── */}
        <View style={styles.medBlock}>
          <MedicationPhoto
            source={medication?.photo_url}
            style={styles.photo}
            fallback={
              <View style={[styles.photoPlaceholder, { borderColor: onFieldMuted }]}>
                <Ionicons name="medical" size={56} color={onField} />
              </View>
            }
          />

          <Text variant="displayMedium" color={onField} center style={styles.medName}>
            {medication?.name ?? 'Tu medicamento'}
          </Text>
          <Text variant="titleLarge" color={onFieldMuted} center>
            {medication ? `${medication.dose_mg} mg` : 'Toma tu dosis ahora'}
            {scheduledLabel ? ` · ${scheduledLabel}` : ''}
          </Text>
        </View>

        {/* ─── Aviso de cola ─── */}
        {moreWaiting > 0 && (
          <View style={[styles.queueBadge, { borderColor: onFieldMuted }]}>
            <Ionicons name="layers-outline" size={22} color={onField} />
            <Text variant="labelMedium" color={onField}>
              {moreWaiting === 1
                ? 'Después de esta hay 1 medicamento más'
                : `Después de esta hay ${moreWaiting} medicamentos más`}
            </Text>
          </View>
        )}

        {/* ─── Acción principal: la superficie más grande de toda la app ─── */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ya la tomé. Detiene la alarma y registra la dosis."
          accessibilityState={{ busy: stopping }}
          onPress={handleStopAlarm}
          disabled={stopping}
          style={({ pressed }) => [
            styles.primaryAction,
            { backgroundColor: actionSurface },
            (pressed || stopping) && styles.actionPressed,
          ]}
        >
          {stopping ? (
            <ActivityIndicator size="large" color={onActionSurface} />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={48} color={onActionSurface} />
              <Text variant="headlineSmall" color={onActionSurface} center style={styles.primaryActionLabel}>
                YA LA TOMÉ
              </Text>
              <Text variant="bodySmall" color={onActionSurface} center>
                Detiene la alarma
              </Text>
            </>
          )}
        </Pressable>

        {/* ─── Acción secundaria ─── */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Posponer 5 minutos"
          accessibilityState={{ busy: snoozing }}
          onPress={handleSnooze}
          disabled={snoozing || stopping}
          style={({ pressed }) => [
            styles.secondaryAction,
            { borderColor: onField },
            (pressed || snoozing) && styles.actionPressed,
          ]}
        >
          {snoozing ? (
            <ActivityIndicator size="small" color={onField} />
          ) : (
            <>
              <Ionicons name="time-outline" size={28} color={onField} />
              <Text variant="labelLarge" color={onField}>
                Posponer 5 minutos
              </Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SCREEN_MARGIN,
  },
  // ─── Píldora de estado ───
  alarmChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: SHAPE.full,
  },
  // ─── Medicamento ───
  medBlock: {
    alignItems: 'center',
    marginTop: SPACING.xxl,
    marginBottom: SPACING.xxl,
  },
  photo: {
    width: 132,
    height: 132,
    borderRadius: SHAPE.extraLarge,
    marginBottom: SPACING.xl,
  },
  photoPlaceholder: {
    width: 132,
    height: 132,
    borderRadius: SHAPE.extraLarge,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  medName: {
    marginBottom: SPACING.xs,
  },
  // ─── Cola ───
  queueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: SHAPE.full,
    borderWidth: 1,
    marginBottom: SPACING.xl,
  },
  // ─── Acciones ───
  primaryAction: {
    width: '100%',
    minHeight: 168,
    borderRadius: SHAPE.extraLarge,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  primaryActionLabel: {
    marginTop: SPACING.sm,
  },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    width: '100%',
    minHeight: TOUCH.primary,
    borderRadius: SHAPE.full,
    borderWidth: 2,
    marginTop: SPACING.lg,
  },
  actionPressed: {
    opacity: 0.85,
  },
});
