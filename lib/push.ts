import { supabase } from '@/lib/supabase';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
// Token de notificaciones push.
//
// Las alarmas del paciente son y siguen siendo LOCALES: no dependen de
// internet ni de ningún servidor, que es justo lo que las hace fiables. Esto
// es otra cosa — el canal para avisarle al CUIDADOR, desde el servidor, que su
// familiar no confirmó una dosis. Sin push no hay forma: el teléfono del
// cuidador no sabe nada hasta que alguien abre la app.
//
// El token se guarda por dispositivo (device_tokens.expo_push_token es UNIQUE),
// no por usuario: una persona puede tener teléfono y tablet, y un mismo
// teléfono puede cambiar de manos. Al iniciar sesión el token se reasigna a
// quien acaba de entrar; al cerrar sesión se borra, para que las alertas de un
// paciente no sigan llegando al teléfono de alguien que ya salió.
// ─────────────────────────────────────────────────────────────────────────────

/** Canal aparte del de alarmas: esto informa, no despierta a nadie de noche. */
export const CAREGIVER_CHANNEL_ID = 'avisos_cuidador';

let cachedToken: string | null = null;

function getProjectId(): string | null {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    null
  );
}

async function fetchExpoPushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  const projectId = getProjectId();
  if (!projectId) {
    console.log('Sin projectId de EAS — no se puede pedir el token push.');
    return null;
  }

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch (e) {
    // Falla esperable en emuladores y en Expo Go sin build nativo. No es
    // motivo para romper el inicio de sesión.
    console.log('No se pudo obtener el token push:', e);
    return null;
  }
}

/**
 * Crea el canal Android donde caen los avisos de cuidador. Importancia alta
 * pero sin bypassDnd ni pantalla completa: que un familiar no confirme una
 * dosis merece un aviso, no el tratamiento de una alarma.
 */
export async function setupCaregiverChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(CAREGIVER_CHANNEL_ID, {
      name: 'Avisos de cuidado',
      description: 'Cuando alguien a quien cuidas no confirma una dosis',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      enableVibrate: true,
      vibrationPattern: [0, 400, 200, 400],
    });
  } catch (e) {
    console.log('No se pudo crear el canal de avisos de cuidador:', e);
  }
}

/**
 * Guarda el token de este dispositivo para el usuario con sesión activa.
 * Idempotente: se puede llamar en cada arranque sin duplicar filas.
 */
export async function registerDeviceToken(): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.user?.id) return;

  const token = await fetchExpoPushToken();
  if (!token) return;

  cachedToken = token;

  // Vía RPC y no upsert directo: si el teléfono cambió de manos, la fila de
  // este token pertenece a otro usuario y RLS impediría reclamarla — el nuevo
  // dueño se quedaría sin avisos. register_device_token() lo resuelve del lado
  // del servidor (ver la migración "Avisos push al cuidador").
  const { error } = await supabase.rpc('register_device_token', {
    p_token: token,
    p_platform: Platform.OS,
  });

  if (error) console.log('No se pudo guardar el token push:', error.message);
}

/**
 * Borra el token de este dispositivo. Se llama ANTES de cerrar sesión: después
 * ya no habría permiso de RLS para borrar la fila, y el teléfono se quedaría
 * recibiendo avisos de una cuenta a la que ya no pertenece.
 */
export async function unregisterDeviceToken(): Promise<void> {
  const token = cachedToken ?? (await fetchExpoPushToken());
  if (!token) return;

  const { error } = await supabase.from('device_tokens').delete().eq('expo_push_token', token);
  if (error) console.log('No se pudo borrar el token push:', error.message);

  cachedToken = null;
}
