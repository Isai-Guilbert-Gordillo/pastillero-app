import * as IntentLauncher from 'expo-intent-launcher';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { doseGrid } from './doseSchedule';
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
          vibrationPattern: [0, 1000, 200, 1000, 200, 1000, 200, 1500],
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
            vibrationPattern: [0, 1000, 200, 1000, 200, 1000, 200, 1500],
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

      // ─── Canal aparte para los recordatorios de seguimiento ───
      // En Android la vibración y la importancia son del CANAL, no de cada
      // notificación: sin un segundo canal, el "oye, sigue pendiente" vibra
      // tan fuerte como el "¡es tu hora!". Con tres medicamentos a la misma
      // hora eso eran varias sacudidas de 6 segundos solapadas.
      //
      // La alarma manda una vez, con todo. El recordatorio avisa, no grita:
      // importancia alta (no MAX), vibración corta, sin saltarse No molestar
      // y con sonido de notificación, no de alarma.
      try {
        await Notifications.setNotificationChannelAsync('recordatorio_medicamentos', {
          name: 'Recordatorio de dosis pendiente',
          description: 'Aviso suave cuando una dosis sigue sin confirmarse',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 400],
          sound: 'default',
          enableVibrate: true,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          bypassDnd: false,
          audioAttributes: {
            usage: Notifications.AndroidAudioUsage.NOTIFICATION,
            contentType: Notifications.AndroidAudioContentType.SONIFICATION,
          },
        });
      } catch (e) {
        console.log('Reminder channel setup error:', e);
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
 *
 * Si el medicamento es "por_tiempo" y ya tiene end_date, el límite de 7 días
 * se recorta ahí — así un tratamiento vencido no sigue agendándose cada vez
 * que se renueva la ventana de notificaciones (ver renewMedicationNotificationsIfNeeded).
 */
export function computeDoseDates(medication: Medication, now: Date = new Date()): Date[] {
  // Límite: 7 días desde ahora, recortado a end_date si el tratamiento es por tiempo limitado
  let limit = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (medication.regimen_type === 'por_tiempo' && medication.end_date) {
    const end = new Date(`${medication.end_date}T23:59:59`);
    if (end.getTime() < limit.getTime()) limit = end;
  }

  // La rejilla vive en lib/doseSchedule.ts y la comparte el historial. Antes
  // esta función tenía su propia cuenta, que rompía el ciclo saltando a mañana
  // cuando start_time ya había pasado e ignoraba days_of_week — la alarma
  // sonaba a una hora y el historial decía otra. Ver doseSchedule.ts.
  return doseGrid({
    startTime: medication.start_time,
    frequencyHours: medication.frequency_hours,
    daysOfWeek: medication.days_of_week,
    from: now,
    to: limit,
    now,
  });
}

/**
 * Calcula las horas del día en que toca una dosis (ej. 08:00, 16:00, 00:00
 * para "cada 8h desde las 8:00"). Se usa para crear alarmas NATIVAS que se
 * repiten todos los días, en vez de una fecha exacta por cada toma.
 * Si la frecuencia no divide 24h de forma exacta, se calculan las horas de
 * un solo ciclo de 24h a partir de start_time (puede no repetirse "limpio"
 * día a día, pero es el mejor resultado posible con una alarma nativa).
 */
function computeDailyTimes(medication: Medication): string[] {
  const [h, m] = medication.start_time.split(':').map(Number);
  const times = new Set<string>();
  let hours = h;
  let minutes = m;
  let iterations = 0;
  const maxIterations = Math.max(1, Math.ceil(24 / medication.frequency_hours)) + 1;

  while (iterations < maxIterations) {
    const key = `${String(hours % 24).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    if (times.has(key)) break; // completó el ciclo de 24h
    times.add(key);
    hours = hours + medication.frequency_hours;
    iterations++;
  }

  return Array.from(times);
}

// Calendar.DAY_OF_WEEK de Android: domingo=1, lunes=2, ... sábado=7
const DAY_TO_CALENDAR: Record<string, number> = {
  sun: 1, mon: 2, tue: 3, wed: 4, thu: 5, fri: 6, sat: 7,
};

/**
 * ALARMA NATIVA DEL TELÉFONO (recomendado)
 *
 * Crea una alarma real en la app de Reloj del teléfono (la misma que ya
 * conoce cualquier persona) por cada hora del día en que toca una dosis,
 * repitiéndose en los días seleccionados. A diferencia de las notificaciones
 * de arriba, esta alarma SIGUE SONANDO aunque PastilleroApp esté cerrada,
 * porque la maneja el sistema operativo, no la app.
 *
 * Requiere declarar el permiso "com.android.alarm.permission.SET_ALARM"
 * en app.json — sin él, Android rechaza el intent con SecurityException
 * antes de que el Reloj llegue siquiera a procesarlo.
 *
 * Limitaciones conocidas (no hay forma de evitarlas, son del sistema Android):
 *  - Al sonar, se apaga/pospone desde la app de Reloj, no desde PastilleroApp,
 *    así que no queda registrada automáticamente en el Historial.
 *  - Si se borra o edita el medicamento, la alarma creada en el Reloj NO se
 *    borra sola — hay que borrarla manualmente ahí.
 *  - Si el teléfono no soporta repetir por días, sonará una sola vez.
 */
export interface NativeAlarmResult {
  attempted: number;
  succeeded: number;
  times: string[];
  errors: string[];
}

export async function scheduleNativeAlarms(medication: Medication): Promise<NativeAlarmResult> {
  const result: NativeAlarmResult = { attempted: 0, succeeded: 0, times: [], errors: [] };
  if (Platform.OS !== 'android') return result;

  const days = (medication.days_of_week?.length ? medication.days_of_week : ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])
    .map((d) => DAY_TO_CALENDAR[d])
    .filter((n): n is number => typeof n === 'number');

  const times = computeDailyTimes(medication);

  for (const time of times) {
    const [hour, minute] = time.split(':').map(Number);
    result.attempted++;
    try {
      const res = await IntentLauncher.startActivityAsync('android.intent.action.SET_ALARM', {
        extra: {
          'android.intent.extra.alarm.HOUR': hour,
          'android.intent.extra.alarm.MINUTES': minute,
          'android.intent.extra.alarm.MESSAGE': `💊 ${medication.name} ${medication.dose_mg}mg — abre PastilleroApp y confirma`,
          'android.intent.extra.alarm.DAYS': days,
          'android.intent.extra.alarm.SKIP_UI': true,
          'android.intent.extra.alarm.VIBRATE': true,
        },
      });
      console.log(`Alarma nativa ${time} → resultCode: ${res.resultCode}`);
      result.succeeded++;
      result.times.push(time);
    } catch (e: any) {
      const msg = e?.message || String(e);
      console.log(`No se pudo crear la alarma nativa a las ${time}:`, e);
      result.errors.push(`${time} — ${msg}`);
    }
  }
  return result;
}

/**
 * SISTEMA DE ALARMA PERSISTENTE PARA ABUELAS
 *
 * Por cada dosis programa:
 *   - 1 notificación principal al momento exacto (canal de ALARMA)
 *   - 1 recordatorio a los 5 minutos (canal de RECORDATORIO, suave)
 *
 * La escalada real no vive aquí. Primero fueron 9 recordatorios cada 60 s,
 * luego 3 cada 5 min, y seguía siendo demasiado: con tres medicamentos a la
 * misma hora eran 12 notificaciones en 20 minutos, cada una con 6 segundos
 * de vibración de alarma, encima de las alarmas del Reloj que ya suenan solas
 * para los "indefinido".
 *
 * Repetir la misma alarma cuatro veces no es escalar, es insistir. La escalada
 * de verdad cambia de canal: si a los 30 minutos la dosis sigue sin confirmar,
 * notify_caregivers_of_missed_doses() avisa al CUIDADOR (ver README). Eso cubre
 * el caso de no respuesta mucho mejor que gritarle más fuerte a quien ya no
 * está oyendo.
 *
 * Los recordatorios se cancelan en cuanto se confirma la dosis, desde la app
 * o desde el botón de la notificación (ver cancelPersistentAlarm).
 */
const REMINDER_COUNT = 1;         // 1 recordatorio después de la principal
const REMINDER_INTERVAL_SEC = 300; // a los 5 minutos

const REMINDER_MESSAGES = [
  'Sigue pendiente. Toca "Ya la tomé" cuando la tomes.',
];

export async function scheduleMedicationNotifications(medication: Medication): Promise<string[]> {
  const notificationIds: string[] = [];

  try {
    const now = new Date();
    const doseDates = computeDoseDates(medication);

    for (const doseDate of doseDates) {
      // Usar Math.floor para que la alarma suene justo al momento o ligeramente antes, nunca después
      const secondsFromNow = Math.max(1, Math.floor((doseDate.getTime() - now.getTime()) / 1000));

      // ═══ Notificación PRINCIPAL ═══
      const mainId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '🔔 ¡HORA DE TU MEDICAMENTO!',
          body: `Toma ${medication.name} - ${medication.dose_mg}mg\nAbre la app para confirmar`,
          data: {
            medicationId: medication.id,
            type: 'ALARM',
            scheduledAt: doseDate.toISOString(),
          },
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
          sticky: true,
          autoDismiss: false,
          categoryIdentifier: 'alarm',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: secondsFromNow,
          repeats: false,
          channelId: 'alarma_medicamentos',
        },
      });
      notificationIds.push(mainId);

      // ═══ Recordatorio de SEGUIMIENTO (uno, a los 5 min, en tono menor) ═══
      // Ya no grita: canal suave, prioridad alta en vez de MAX, y se puede
      // descartar. La alarma manda una vez; esto solo recuerda que sigue ahí.
      for (let i = 0; i < REMINDER_COUNT; i++) {
        const reminderSeconds = secondsFromNow + (i + 1) * REMINDER_INTERVAL_SEC;
        if (reminderSeconds <= 0) continue;

        try {
          const reminderId = await Notifications.scheduleNotificationAsync({
            content: {
              title: `Falta confirmar ${medication.name}`,
              body: `${medication.dose_mg} mg · ${REMINDER_MESSAGES[i]}`,
              data: {
                medicationId: medication.id,
                type: 'ALARM',
                scheduledAt: doseDate.toISOString(),
                isReminder: true,
                reminderIndex: i + 1,
              },
              sound: 'default',
              priority: Notifications.AndroidNotificationPriority.HIGH,
              sticky: false,
              autoDismiss: true,
              categoryIdentifier: 'alarm',
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
              seconds: reminderSeconds,
              repeats: false,
              channelId: 'recordatorio_medicamentos',
            },
          });
          notificationIds.push(reminderId);
        } catch (e) {
          console.log(`Error scheduling reminder ${i + 1}:`, e);
        }
      }
    }
  } catch (e) {
    console.log('Error scheduling notifications:', e);
  }

  return notificationIds;
}

/**
 * Cancela los recordatorios persistentes de UNA DOSIS específica.
 * Solo cancela notificaciones con el mismo medicationId Y scheduledAt.
 * Las dosis futuras de días siguientes NO se tocan.
 */
export async function cancelPersistentAlarm(medicationId: string, scheduledAt?: string): Promise<void> {
  try {
    // Cancelar notificaciones programadas (futuras) de esta dosis
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of scheduled) {
      const d = notif.content.data;
      if (d?.medicationId === medicationId) {
        // Si se proporcionó scheduledAt, solo cancelar esa dosis específica
        if (scheduledAt && d?.scheduledAt && d.scheduledAt !== scheduledAt) continue;
        await Notifications.cancelScheduledNotificationAsync(notif.identifier).catch(() => {});
      }
    }
    // Limpiar notificaciones ya mostradas de esta dosis
    const presented = await Notifications.getPresentedNotificationsAsync();
    for (const notif of presented) {
      const d = notif.request.content.data;
      if (d?.medicationId === medicationId) {
        if (scheduledAt && d?.scheduledAt && d.scheduledAt !== scheduledAt) continue;
        await Notifications.dismissNotificationAsync(notif.request.identifier).catch(() => {});
      }
    }
  } catch (e) {
    console.log('Error canceling persistent alarm:', e);
  }
}

/**
 * Pospone la alarma de una dosis: cancela los recordatorios pendientes de
 * ESA dosis y programa una nueva notificación en `minutes` minutos.
 * Usado tanto desde el botón "Recordar en 5 min" de la notificación de Android
 * como desde el botón "Posponer" dentro de la pantalla de alarma.
 */
export async function snoozeAlarm(
  medicationId: string,
  data: Record<string, unknown>,
  scheduledAt?: string,
  minutes: number = 5
): Promise<void> {
  await cancelPersistentAlarm(medicationId, scheduledAt);
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔔 ¡HORA DE TU MEDICAMENTO!',
        body: 'Recordatorio — toma tu medicamento ahora',
        data: { ...data },
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.MAX,
        sticky: true,
        autoDismiss: false,
        categoryIdentifier: 'alarm',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: minutes * 60,
        repeats: false,
        channelId: 'alarma_medicamentos',
      },
    });
  } catch (e) {
    console.log('Error reprogramando snooze:', e);
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

/**
 * RENOVACIÓN DE LA VENTANA DE 7 DÍAS
 *
 * computeDoseDates() solo agenda notificaciones para los próximos 7 días —
 * es una limitación necesaria (no se puede agendar "para siempre" de una
 * sola vez), pero como nada las volvía a programar, un medicamento "para
 * siempre" dejaba de sonar en silencio a la semana de haberse creado o
 * editado por última vez.
 *
 * Esta función revisa, para UN medicamento, cuál es la dosis programada más
 * lejana que sigue en la cola de expo-notifications. Si queda poco margen
 * (menos de RENEWAL_THRESHOLD_DAYS), cancela lo que quede y vuelve a
 * agendar un bloque fresco de 7 días hacia adelante — igual que se hace al
 * crear o editar el medicamento.
 *
 * Es seguro llamarla seguido (por ejemplo cada vez que Inicio toma foco,
 * igual que reconcileDoseRecords): si todavía hay margen, no hace nada y
 * devuelve null. Si el tratamiento es "por_tiempo" y ya venció, tampoco hace
 * nada — no tiene caso reprogramar notificaciones para un tratamiento que
 * ya terminó.
 *
 * Devuelve los notification_ids nuevos si reprogramó (para guardarlos en la
 * fila de `medications`), o null si no hizo falta tocar nada.
 */
const RENEWAL_THRESHOLD_DAYS = 2;

export async function renewMedicationNotificationsIfNeeded(medication: Medication): Promise<string[] | null> {
  if (medication.regimen_type === 'por_tiempo' && medication.end_date) {
    const end = new Date(`${medication.end_date}T23:59:59`);
    if (end.getTime() <= Date.now()) return null; // tratamiento ya vencido, no renovar
  }

  let latestScheduled = 0;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of scheduled) {
      const d = notif.content.data;
      if (d?.medicationId !== medication.id) continue;
      const scheduledAt = typeof d.scheduledAt === 'string' ? new Date(d.scheduledAt).getTime() : 0;
      if (scheduledAt > latestScheduled) latestScheduled = scheduledAt;
    }
  } catch (e) {
    console.log('Error revisando notificaciones programadas:', e);
    return null;
  }

  const threshold = Date.now() + RENEWAL_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
  if (latestScheduled >= threshold) return null; // todavía hay ventana suficiente

  await cancelAllMedicationNotifications(medication.id);
  return scheduleMedicationNotifications(medication);
}

export async function cancelAllNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (e) {
    console.log('Error canceling all notifications:', e);
  }
}

/**
 * Dispara una alarma de PRUEBA dentro de unos segundos.
 *
 * Existe por un hueco real del primer uso: terminabas de dar de alta un
 * medicamento y no pasaba nada durante horas, así que no había forma de saber
 * si la cosa servía. Esto cierra ese bucle — configuras y, diez segundos
 * después, lo ves y lo oyes.
 *
 * Y prueba lo que de verdad se rompe en la vida real: permiso de
 * notificaciones, canal de alarma, sonido y que Android no esté matando la
 * app por ahorro de batería.
 *
 * NO lleva `medicationId` ni `type: 'ALARM'` a propósito. Con esa carga, los
 * observadores de app/_layout.tsx la tratarían como una dosis de verdad: se
 * abriría la pantalla de alarma a pantalla completa y, peor, tocar "Ya la
 * tomé" escribiría una dosis falsa en el historial médico. Una prueba no
 * puede ensuciar el registro de salud.
 */
export async function scheduleTestAlarm(medicationName: string, seconds = 10): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🔔 Prueba de alarma',
      body: `Así se va a oír el recordatorio de ${medicationName}. Esto es solo una prueba, no una dosis.`,
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.MAX,
      data: { type: 'TEST' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      repeats: false,
      channelId: 'alarma_medicamentos',
    },
  });
}

/**
 * Configura categorías de notificación con botones de acción.
 * Permite al usuario interactuar directamente desde la notificación.
 */
export async function setupNotificationCategories(): Promise<void> {
  try {
    await Notifications.setNotificationCategoryAsync('alarm', [
      {
        identifier: 'TAKE_MEDICINE',
        buttonTitle: '✅ Ya la tomé',
        options: {
          // `false` a propósito: el botón promete que con tocarlo ya está.
          // Estaba en `true`, así que abría la app y además la pantalla de
          // alarma a pantalla completa, donde había que confirmar OTRA VEZ —
          // la única vía para resolverlo sin entrar a la app te metía a la
          // app. La dosis se registra sin abrir nada; ver el observador de
          // respuestas en app/_layout.tsx.
          opensAppToForeground: false,
        },
      },
      {
        identifier: 'SNOOZE',
        buttonTitle: '⏰ Recordar en 5 min',
        options: {
          opensAppToForeground: false,
        },
      },
    ]);
  } catch (e) {
    console.log('Error setting notification category:', e);
  }
}
