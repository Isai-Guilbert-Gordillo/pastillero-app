import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import * as Notifications from 'expo-notifications';
import { Platform, Vibration } from 'react-native';

let alarmSound: Audio.Sound | null = null;
let isPlaying = false;
let notifInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Inicia la alarma usando el sonido de alarma del sistema Android.
 * Reproduce en loop a volumen máximo, incluso en modo silencio.
 * Si falla, dispara notificaciones repetidas como fallback.
 */
export async function startAlarm(): Promise<void> {
  if (isPlaying) return;
  isPlaying = true;

  try {
    // Configurar audio: volumen máximo, modo alarma, suena en silencio
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      interruptionModeIOS: InterruptionModeIOS.DuckOthers,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    });

    // Descargar sonido anterior si existe
    if (alarmSound) {
      try { await alarmSound.unloadAsync(); } catch (_) {}
      alarmSound = null;
    }

    let soundLoaded = false;

    // === INTENTO 1: Sonido de alarma del sistema Android ===
    if (Platform.OS === 'android') {
      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: 'content://settings/system/alarm_alert' },
          { isLooping: true, volume: 1.0, shouldPlay: true }
        );
        alarmSound = sound;
        soundLoaded = true;
        console.log('✅ Alarma del sistema Android iniciada');
      } catch (e) {
        console.log('⚠️ No se pudo cargar alarma del sistema, intentando ringtone...', e);
      }
    }

    // === INTENTO 2: Ringtone del sistema ===
    if (!soundLoaded && Platform.OS === 'android') {
      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: 'content://settings/system/ringtone' },
          { isLooping: true, volume: 1.0, shouldPlay: true }
        );
        alarmSound = sound;
        soundLoaded = true;
        console.log('✅ Ringtone del sistema iniciado como alarma');
      } catch (e) {
        console.log('⚠️ No se pudo cargar ringtone del sistema:', e);
      }
    }

    // === INTENTO 3: Sonido de notificación del sistema ===
    if (!soundLoaded && Platform.OS === 'android') {
      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: 'content://settings/system/notification_sound' },
          { isLooping: true, volume: 1.0, shouldPlay: true }
        );
        alarmSound = sound;
        soundLoaded = true;
        console.log('✅ Sonido de notificación del sistema como alarma');
      } catch (e) {
        console.log('⚠️ No se pudo cargar sonido de notificación:', e);
      }
    }

    // === FALLBACK FINAL: Notificaciones repetidas con sonido del sistema ===
    if (!soundLoaded) {
      console.log('⚠️ Usando notificaciones como alarma de respaldo');
      startNotificationFallback();
    }

    // Verificar que el sonido está reproduciéndose
    if (alarmSound) {
      const status = await alarmSound.getStatusAsync();
      if (status.isLoaded && !status.isPlaying) {
        await alarmSound.playAsync();
      }
    }

    // Vibración AGRESIVA continua — patrón largo y fuerte para abuelas
    Vibration.vibrate(
      [0, 1000, 200, 1000, 200, 1000, 200, 1500, 300, 1500, 300, 1500],
      true
    );

    console.log('🔔 Alarma iniciada');
  } catch (e) {
    console.log('Error starting alarm:', e);
    // Último recurso: vibración continua + notificaciones
    Vibration.vibrate([0, 500, 300, 500, 300, 500, 300, 500], true);
    startNotificationFallback();
  }
}

/**
 * Fallback: dispara notificaciones repetidas para simular alarma.
 */
function startNotificationFallback(): void {
  // Disparar primera notificación inmediatamente
  fireAlarmNotification();
  // Repetir cada 4 segundos
  notifInterval = setInterval(() => {
    fireAlarmNotification();
  }, 4000);
}

async function fireAlarmNotification(): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔔 ¡HORA DE TU MEDICAMENTO!',
        body: 'Abre la app para marcar tu dosis',
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
        sticky: true,
      },
      trigger: null, // Inmediata
    });
  } catch (_) {}
}

/**
 * Detiene la alarma y libera recursos.
 * Diseño "fallo seguro": primero mata vibración y estado síncronamente,
 * luego limpia audio y notificaciones de forma asíncrona.
 */
export function stopAlarm(): void {
  // ── PASO 0 (síncrono, nunca falla) ──
  isPlaying = false;
  Vibration.cancel();

  // Detener intervalo de notificaciones fallback
  if (notifInterval) {
    clearInterval(notifInterval);
    notifInterval = null;
  }

  // ── PASO 1 (asíncrono, fire-and-forget) ──
  const soundRef = alarmSound;
  alarmSound = null;

  // Limpiar audio en background — no bloqueamos el hilo
  if (soundRef) {
    soundRef.stopAsync()
      .then(() => soundRef.unloadAsync())
      .catch(() => soundRef.unloadAsync().catch(() => {}));
  }

  // Limpiar notificaciones — fire-and-forget
  Notifications.dismissAllNotificationsAsync().catch(() => {});
}

/**
 * Devuelve si la alarma está sonando.
 */
export function isAlarmPlaying(): boolean {
  return isPlaying;
}
