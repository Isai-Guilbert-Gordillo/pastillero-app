import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Medication } from './types';

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,   // Mostrar banner para que Android la presente
      shouldPlaySound: true,   // Sonido del canal ALARM
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch (e) {
  console.log('Notification handler setup skipped:', e);
}

export async function registerForPushNotifications(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return false;
    }

    // Canal de notificación tipo ALARMA con sonido del sistema
    if (Platform.OS === 'android') {
      try {
        // Eliminar canales viejos para que se apliquen los cambios
        await Notifications.deleteNotificationChannelAsync('medicamentos').catch(() => {});
        await Notifications.deleteNotificationChannelAsync('alarma_medicamentos').catch(() => {});
        
        await Notifications.setNotificationChannelAsync('alarma_medicamentos', {
          name: 'Alarma de Medicamentos',
          description: 'Alarma sonora cuando es hora de tomar un medicamento',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          sound: 'default',
          enableLights: true,
          lightColor: '#FF0000',
          enableVibrate: true,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          bypassDnd: true,
          audioAttributes: {
            usage: Notifications.AndroidAudioUsage.ALARM,
            contentType: Notifications.AndroidAudioContentType.SONIFICATION,
          },
        });
      } catch (e) {
        console.log('Notification channel setup error:', e);
        // Fallback: canal básico
        try {
          await Notifications.setNotificationChannelAsync('alarma_medicamentos', {
            name: 'Alarma de Medicamentos',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            sound: 'default',
            enableVibrate: true,
            bypassDnd: true,
            audioAttributes: {
              usage: Notifications.AndroidAudioUsage.ALARM,
              contentType: Notifications.AndroidAudioContentType.SONIFICATION,
            },
          });
        } catch (e2) {
          console.log('Fallback channel also failed:', e2);
        }
      }
    }

    return true;
  } catch (e) {
    console.log('Notification permission error:', e);
    return false;
  }
}

/**
 * Calcula todas las fechas de dosis para los próximos 7 días.
 * La primera dosis se programa a la start_time seleccionada.
 * Si esa hora ya pasó hoy, se programa para mañana.
 * Las siguientes dosis siguen el intervalo de frequency_hours.
 */
export function computeDoseDates(medication: Medication): Date[] {
  const [hours, minutes] = medication.start_time.split(':').map(Number);
  const frequencyMs = medication.frequency_hours * 60 * 60 * 1000;
  const now = new Date();
  const dates: Date[] = [];

  // Primera dosis: hoy a la start_time. Si ya pasó, mañana.
  const firstDose = new Date();
  firstDose.setHours(hours, minutes, 0, 0);
  if (firstDose <= now) {
    firstDose.setDate(firstDose.getDate() + 1);
  }

  // Límite: 7 días desde ahora
  const limit = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  let current = new Date(firstDose.getTime());
  while (current <= limit) {
    dates.push(new Date(current.getTime()));
    current = new Date(current.getTime() + frequencyMs);
  }

  return dates;
}

export async function scheduleMedicationNotifications(medication: Medication): Promise<string[]> {
  const notificationIds: string[] = [];

  try {
    const now = new Date();
    const doseDates = computeDoseDates(medication);

    for (const doseDate of doseDates) {
      // Calculate seconds from now — compatible with Expo Go
      const secondsFromNow = Math.max(1, Math.round((doseDate.getTime() - now.getTime()) / 1000));

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: '🔔 ¡HORA DE TU MEDICAMENTO!',
          body: `Toma ${medication.name} - ${medication.dose_mg}mg\nAbre la app para detener la alarma`,
          data: {
            medicationId: medication.id,
            type: 'ALARM',
            scheduledAt: doseDate.toISOString(),
          },
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
          sticky: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: secondsFromNow,
          repeats: false,
          channelId: 'alarma_medicamentos',
        },
      });

      notificationIds.push(id);
    }
  } catch (e) {
    console.log('Error scheduling notifications:', e);
  }

  return notificationIds;
}

/**
 * Cancela notificaciones futuras usando los IDs guardados en la tabla medications.
 * Fire-and-forget: no bloquea el hilo principal.
 */
export function cancelNotificationsByIds(ids: string[]): void {
  if (!ids || ids.length === 0) return;
  for (const id of ids) {
    Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  }
}

export async function cancelAllMedicationNotifications(medicationId: string): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notification of scheduled) {
      if (notification.content.data?.medicationId === medicationId) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }
  } catch (e) {
    console.log('Error canceling notifications:', e);
  }
}

export async function cancelAllNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (e) {
    console.log('Error canceling all notifications:', e);
  }
}
