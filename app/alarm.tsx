import { useAppAlert } from '@/components/AppAlert';
import { useAuth } from '@/context/AuthContext';
import { cancelNotificationsByIds, cancelPersistentAlarm, snoozeAlarm } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { BORDER_RADIUS, COLORS, FONTS, GRADIENTS, SPACING, TOUCH_TARGET } from '@/lib/theme';
import { Medication } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    Vibration,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function AlarmScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { alert } = useAppAlert();
  const params = useLocalSearchParams<{ medicationId: string; scheduledAt: string }>();
  const [medication, setMedication] = useState<Medication | null>(null);
  const [loading, setLoading] = useState(true);
  const [stopping, setStopping] = useState(false);
  const [snoozing, setSnoozing] = useState(false);

  // Referencia para el sonido, para poder detenerlo síncronamente
  const soundRef = useRef<Audio.Sound | null>(null);

  // Pulso del ícono de alarma — refuerza la urgencia
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(withTiming(1.1, { duration: 550 }), withTiming(1, { duration: 550 })),
      -1,
      true
    );
  }, []);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  // Cargar datos del medicamento
  useEffect(() => {
    const fetchMedication = async () => {
      if (!params.medicationId) { // Fallback si no hay ID (modo test manual)
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('medications')
        .select('*')
        .eq('id', params.medicationId)
        .single();

      if (data) setMedication(data);
      setLoading(false);
    };
    fetchMedication();
  }, [params.medicationId]);

  // Motor de Audio y Vibración (Workaround Agresivo)
  useEffect(() => {
    let mounted = true;

    const startAlarmEngine = async () => {
      try {
        // 1. Configuración de Audio para "pisar" cualquier otro sonido
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: true, // Vital para Android 10+ si la app se minimiza
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true, // Bajar volumen de otras apps
          interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
          interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        });

        // 2. Vibración AGRESIVA continua INMEDIATA
        // Patrón largo y fuerte para que sea imposible ignorar
        Vibration.vibrate(
          [0, 1000, 200, 1000, 200, 1000, 200, 1500, 300, 1500, 300, 1500],
          true
        );

        // 3. Cargar sonido de alarma RUIDOSO en bucle
        // Usamos un archivo local para evitar latencia de red
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
          // Si el componente se desmontó mientras cargaba, limpiar
          await sound.unloadAsync();
        }

      } catch (error) {
        console.error('Error en motor de alarma:', error);
        // Fallback: vibración agresiva
        Vibration.vibrate(
          [0, 1000, 200, 1000, 200, 1000, 200, 1500, 300, 1500, 300, 1500],
          true
        );
      }
    };

    startAlarmEngine();

    // Cleanup al desmontar (si el usuario cierra la app a la fuerza o navega atrás)
    return () => {
      mounted = false;
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
      Vibration.cancel();
    };
  }, []);

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
    if (medication?.notification_ids?.length) {
      cancelNotificationsByIds(medication.notification_ids);
    }
  };

  // ─── Botón: Posponer 5 minutos ───
  const handleSnooze = async () => {
    if (snoozing || stopping) return;
    setSnoozing(true);
    await stopSoundAndVibration();
    if (params.medicationId) {
      await snoozeAlarm(
        params.medicationId,
        { medicationId: params.medicationId, type: 'ALARM', scheduledAt: params.scheduledAt || '' },
        params.scheduledAt || undefined
      );
    }
    router.replace('/(tabs)');
  };

  // ─── Botón principal: DETENER TODO ───
  const handleStopAlarm = async () => {
    if (stopping) return;
    setStopping(true);

    // ══ PRIORIDAD 0 — Detención SÍNCRONA (lo que percibe el usuario) ══
    await stopSoundAndVibration();

    // Cancelar TODOS los recordatorios persistentes de ESTA DOSIS
    if (params.medicationId) {
      cancelPersistentAlarm(params.medicationId, params.scheduledAt || undefined).catch(() => {});
    }

    // ══ PRIORIDAD 1 — Guardar en Supabase ══
    try {
      if (user && params.medicationId) {
        const now = new Date();
        const scheduledAt = params.scheduledAt || now.toISOString();

        // Buscar registro pendiente
        const { data: existing } = await supabase
          .from('dose_records')
          .select('id')
          .eq('medication_id', params.medicationId)
          .eq('user_id', user.id)
          .eq('scheduled_at', scheduledAt)
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
            medication_id: params.medicationId,
            user_id: user.id,
            scheduled_at: scheduledAt,
            taken: true,
            responded_at: now.toISOString(),
          });
          if (error) throw error;
        }
      }
      // Éxito — navegar al inicio
      router.replace('/(tabs)');
    } catch (e) {
      console.log('Error guardando en Supabase:', e);
      alert(
        'Alarma detenida',
        'No se pudo la conexión para registrar la dosis. Pero la alarma se detuvo.',
        [
          { text: 'Ir al Inicio', onPress: () => router.replace('/(tabs)') },
          { text: 'Reintentar guardado', onPress: () => { setStopping(false); } },
        ]
      );
    }
  };

  if (loading) {
    return (
      <LinearGradient colors={GRADIENTS.alarm} style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.white} />
        <Text style={{ color: 'white', marginTop: 10, fontFamily: FONTS.family.medium }}>Cargando alarma...</Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={GRADIENTS.alarm} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.content}>
        {/* Ícono de alarma pulsante */}
        <View style={styles.alarmIconContainer}>
          <Animated.View style={[styles.alarmIconOuter, pulseStyle]}>
            <Ionicons name="alarm" size={80} color={COLORS.white} />
          </Animated.View>
        </View>

        {/* Texto principal */}
        <Text style={styles.title}>¡HORA DE TU{'\n'}MEDICAMENTO!</Text>

        {/* Info del medicamento */}
        {medication ? (
          <View style={styles.medCard}>
            <Text style={styles.medEmoji}>💊</Text>
            <Text style={styles.medName}>{medication.name}</Text>
            <Text style={styles.medDose}>{medication.dose_mg} mg</Text>
            {params.scheduledAt && (
              <Text style={styles.medTime}>
                Programada: {new Date(params.scheduledAt).toLocaleTimeString('es-MX', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            )}
          </View>
        ) : (
          <View style={styles.medCard}>
            <Text style={styles.medEmoji}>💊</Text>
            <Text style={styles.medName}>Medicamento</Text>
            <Text style={styles.medDose}>Toma tu dosis ahora</Text>
          </View>
        )}

        {/* Botón gigante — YA LA TOMÉ */}
        <TouchableOpacity
          style={[styles.stopButton, stopping && styles.stopButtonDisabled]}
          onPress={handleStopAlarm}
          activeOpacity={0.7}
          disabled={stopping}
        >
          {stopping ? (
            <ActivityIndicator size="large" color={COLORS.white} />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={40} color={COLORS.white} />
              <Text style={styles.stopButtonText}>DETENER ALARMA</Text>
              <Text style={styles.stopButtonSub}>Confirmar toma</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Botón secundario — Posponer 5 minutos */}
        <TouchableOpacity
          style={[styles.snoozeButton, (snoozing || stopping) && styles.stopButtonDisabled]}
          onPress={handleSnooze}
          activeOpacity={0.7}
          disabled={snoozing || stopping}
        >
          {snoozing ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <>
              <Ionicons name="time-outline" size={26} color={COLORS.white} />
              <Text style={styles.snoozeButtonText}>Posponer 5 minutos</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  // ─── Ícono de alarma ───
  alarmIconContainer: {
    marginBottom: SPACING.lg,
  },
  alarmIconOuter: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  // ─── Texto ───
  title: {
    fontSize: 36,
    fontFamily: FONTS.family.extraBold,
    color: COLORS.white,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    lineHeight: 44,
  },
  // ─── Tarjeta de medicamento ───
  medCard: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
    marginBottom: SPACING.xl,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  medEmoji: {
    fontSize: 48,
    marginBottom: SPACING.sm,
  },
  medName: {
    fontSize: FONTS.sizeHero,
    fontFamily: FONTS.family.extraBold,
    color: COLORS.white,
    textAlign: 'center',
  },
  medDose: {
    fontSize: FONTS.sizeLarge,
    fontFamily: FONTS.family.medium,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
  },
  medTime: {
    fontSize: FONTS.sizeMedium,
    fontFamily: FONTS.family.regular,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 8,
  },
  // ─── Botón principal ───
  stopButton: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.lg + 4,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    minHeight: SCREEN_HEIGHT * 0.15,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  stopButtonDisabled: {
    opacity: 0.7,
  },
  stopButtonText: {
    fontSize: 28,
    fontFamily: FONTS.family.extraBold,
    color: COLORS.danger,
    marginTop: SPACING.sm,
  },
  stopButtonSub: {
    fontSize: FONTS.sizeMedium,
    fontFamily: FONTS.family.medium,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  // ─── Botón secundario: Posponer ───
  snoozeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
    minHeight: TOUCH_TARGET.minHeight,
    width: '100%',
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  snoozeButtonText: {
    fontSize: FONTS.sizeLarge,
    fontFamily: FONTS.family.bold,
    color: COLORS.white,
  },
});
