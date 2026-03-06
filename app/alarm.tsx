import { useAuth } from '@/context/AuthContext';
import { cancelNotificationsByIds } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { BORDER_RADIUS, COLORS, FONTS, SPACING } from '@/lib/theme';
import { Medication } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import * as Notifications from 'expo-notifications';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function AlarmScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ medicationId: string; scheduledAt: string }>();
  const [medication, setMedication] = useState<Medication | null>(null);
  const [loading, setLoading] = useState(true);
  const [stopping, setStopping] = useState(false);
  
  // Referencia para el sonido, para poder detenerlo síncronamente
  const soundRef = useRef<Audio.Sound | null>(null);

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

        // 2. Vibración continua INMEDIATA
        // Patrón: espera 0ms, vibra 800ms, pausa 400ms...
        Vibration.vibrate([0, 800, 400, 800, 400, 800], true);

        // 3. Cargar sonido de alarma RUIDOSO en bucle
        // Usamos un archivo local para evitar latencia de red
        const { sound } = await Audio.Sound.createAsync(
          require('../assets/alarm_sound.wav'),
          { 
            shouldPlay: true, 
            isLooping: true, 
            volume: 1.0 
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
        // Fallback: intentar vibrar de nuevo por si acaso falló algo antes
        Vibration.vibrate([0, 500, 500], true);
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

  // ─── Botón principal: DETENER TODO ───
  const handleStopAlarm = async () => {
    if (stopping) return;
    setStopping(true);

    // ══ PRIORIDAD 0 — Detención SÍNCRONA (lo que percibe el usuario) ══
    Vibration.cancel();
    
    // Detener audio expo-av
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch (e) {
        console.log('Error deteniendo audio:', e);
      }
      soundRef.current = null;
    }

    // Cancelar notificaciones del sistema
    Notifications.dismissAllNotificationsAsync().catch(() => {});

    // Cancelar notificaciones futuras por IDs guardados
    if (medication?.notification_ids?.length) {
      cancelNotificationsByIds(medication.notification_ids);
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
      Alert.alert(
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.white} />
        <Text style={{color: 'white', marginTop: 10}}>Cargando alarma...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        {/* Ícono de alarma pulsante */}
        <View style={styles.alarmIconContainer}>
          <View style={styles.alarmIconOuter}>
            <Ionicons name="alarm" size={80} color={COLORS.white} />
          </View>
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

        {/* Botón secundario — solo detener sin marcar */}
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={() => {
            // Lógica simplificada de detención
            if (soundRef.current) {
              soundRef.current.stopAsync();
              soundRef.current.unloadAsync();
            }
            Vibration.cancel();
            Notifications.dismissAllNotificationsAsync().catch(() => {});
            router.replace('/(tabs)');
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.dismissButtonText}>🔕 Solo detener sonido</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#D32F2F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#D32F2F',
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
    fontWeight: 'bold',
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
    fontWeight: 'bold',
    color: COLORS.white,
    textAlign: 'center',
  },
  medDose: {
    fontSize: FONTS.sizeLarge,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
  },
  medTime: {
    fontSize: FONTS.sizeMedium,
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
    fontWeight: 'bold',
    color: '#D32F2F',
    marginTop: SPACING.sm,
  },
  stopButtonSub: {
    fontSize: FONTS.sizeMedium,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  // ─── Botón secundario ───
  dismissButton: {
    marginTop: SPACING.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
  },
  dismissButtonText: {
    fontSize: FONTS.sizeLarge,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
});
