import { FeedbackProvider } from '@/components/Feedback';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { CaregiverProvider } from '@/context/CaregiverContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { enqueueAlarm } from '@/lib/alarmQueue';
import { registerForPushNotifications, setupNotificationCategories, snoozeAlarm } from '@/lib/notifications';
import { registerDeviceToken, setupCaregiverChannel } from '@/lib/push';
import {
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
    useFonts,
} from '@expo-google-fonts/poppins';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, AppState, AppStateStatus, Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const { scheme } = useTheme();
  const segments = useSegments();
  const router = useRouter();

  const navigationReady = useRef(false);
  // Ref (no state) para que navigateToAlarm, cerrada dentro de efectos con
  // deps [], siempre lea el segmento de ruta actual y no un valor viejo.
  const onAlarmScreenRef = useRef(false);
  useEffect(() => {
    onAlarmScreenRef.current = segments[0] === 'alarm';
  }, [segments]);

  useEffect(() => {
    registerForPushNotifications();
    setupNotificationCategories();
    setupCaregiverChannel();
    // Dar tiempo a que el Stack se monte antes de marcar ready
    const timer = setTimeout(() => {
      navigationReady.current = true;
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // ─── Token push del dispositivo ───
  // Solo con sesión iniciada, y en cada arranque: el token de Expo puede
  // rotar (reinstalación, restauración del teléfono), así que reafirmarlo es
  // más barato que descubrir que dejó de servir cuando hacía falta el aviso.
  useEffect(() => {
    if (!user) return;
    registerDeviceToken();
  }, [user]);

  // ─── Detectar cuando la app vuelve al primer plano ───
  // Encola TODAS las notificaciones ALARM pendientes (antes solo procesaba
  // la primera y descartaba el resto con un `break`, así que un segundo
  // medicamento pendiente se quedaba sin mostrar).
  useEffect(() => {
    const handleAppStateChange = async (nextState: AppStateStatus) => {
      if (nextState === 'active' && navigationReady.current) {
        try {
          const presented = await Notifications.getPresentedNotificationsAsync();
          for (const notif of presented) {
            const data = notif.request.content.data;
            if (data?.medicationId && data?.type === 'ALARM') {
              console.log('🔔 App volvió al foreground con alarma pendiente');
              navigateToAlarm(data);
              // Limpiar la notificación del sistema ya que estamos abriendo la alarma
              Notifications.dismissNotificationAsync(notif.request.identifier).catch(() => {});
            }
          }
        } catch (e) {
          console.log('Error checking pending notifications:', e);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  // ─── Escuchar deep links (para cuando el background task abre la app) ───
  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      if (!navigationReady.current) return;
      const parsed = Linking.parse(event.url);
      if (parsed.path === 'alarm' || parsed.path === '/alarm') {
        const medicationId = parsed.queryParams?.medicationId;
        const scheduledAt = parsed.queryParams?.scheduledAt;
        if (medicationId) {
          navigateToAlarm({
            medicationId: String(medicationId),
            type: 'ALARM',
            scheduledAt: scheduledAt ? String(scheduledAt) : '',
          });
        }
      }
    };

    // Escuchar links entrantes
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Verificar si la app se abrió con un deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        setTimeout(() => handleDeepLink({ url }), 800);
      }
    });

    return () => subscription.remove();
  }, []);

  // Helper: agrega la dosis a la cola compartida (lib/alarmQueue.ts) y solo
  // navega a /alarm si no estamos ya ahí — así dos medicamentos cerca en el
  // tiempo comparten UNA sola pantalla en vez de apilar una por encima de
  // otra (lo que dejaba sonando para siempre la que quedaba enterrada).
  const navigateToAlarm = (data: Record<string, unknown>) => {
    if (!navigationReady.current || !data.medicationId) return;

    const added = enqueueAlarm({
      medicationId: String(data.medicationId),
      scheduledAt: data.scheduledAt ? String(data.scheduledAt) : '',
    });
    if (!added) return; // ya estaba encolada o ya se confirmó

    if (onAlarmScreenRef.current) return; // AlarmScreen ya está suscrita a la cola

    // NO iniciar alarma aquí — AlarmScreen lo hace en su useEffect
    router.push('/alarm');
  };

  // ─── Observador global: notificación recibida en PRIMER PLANO ───
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data;
      if (data?.medicationId && data?.type === 'ALARM') {
        console.log('🔔 Notificación ALARM recibida en foreground');
        navigateToAlarm(data);
      }
    });
    return () => subscription.remove();
  }, []);

  // ─── Observador global: usuario TOCA la notificación o un botón de acción ───
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const data = response.notification.request.content.data;
      const actionId = response.actionIdentifier;

      // Solo las alarmas locales del propio paciente abren la pantalla de
      // alarma. Un aviso push de cuidador ("no confirmó su dosis") llega al
      // teléfono de OTRA persona: hacerle sonar una alarma a pantalla completa
      // por la medicina de un tercero sería, además de absurdo, peligroso.
      if (!data?.medicationId || data?.type !== 'ALARM') return;

      // Si tocó "Recordar en 5 min" → cancelar recordatorios actuales y reprogramar
      if (actionId === 'SNOOZE') {
        console.log('⏰ Snooze — reprogramando en 5 min');
        if (data.medicationId) {
          const scheduledAt = data.scheduledAt ? String(data.scheduledAt) : undefined;
          await snoozeAlarm(String(data.medicationId), data, scheduledAt);
        }
        return;
      }

      // Cualquier otra acción (tap, TAKE_MEDICINE) → abrir AlarmScreen
      console.log('🔔 Notificación tocada — abriendo AlarmScreen');
      navigateToAlarm(data);
    });
    return () => subscription.remove();
  }, []);

  // ─── Detectar notificación que abrió la app (cold start) ───
  useEffect(() => {
    if (Platform.OS === 'web') return;
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const data = response.notification.request.content.data;
      // Mismo filtro que el observador de arriba: solo alarmas propias.
      if (data?.medicationId && data?.type === 'ALARM') {
        // Esperar a que la navegación esté lista
        const timer = setTimeout(() => {
          navigateToAlarm(data);
        }, 800);
        return () => clearTimeout(timer);
      }
    });
  }, []);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)');
      // Mostrar guía de permisos en el primer inicio de sesión
      if (Platform.OS === 'android') {
        AsyncStorage.getItem('permissions_guide_shown').then((val) => {
          if (!val) {
            AsyncStorage.setItem('permissions_guide_shown', 'true');
            setTimeout(() => {
              router.push('/permissions-guide' as any);
            }, 1500);
          }
        });
      }
    }
  }, [user, loading, segments]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: scheme.background }}>
        <ActivityIndicator size="large" color={scheme.primary} />
      </View>
    );
  }

  return (
    <>
      {/* Edge-to-edge: la barra de estado es transparente y cada pantalla aplica
          sus propios insets. El estilo de los íconos sigue al esquema activo, no
          a una constante — en oscuro, íconos oscuros serían invisibles. */}
      <StatusBar style={scheme.dark ? 'light' : 'dark'} translucent backgroundColor="transparent" />

      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: scheme.background },
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="add"
          options={{
            // Alta de medicamento: pantalla completa sobre la barra de
            // navegación. Es una tarea con principio y fin, no un destino.
            presentation: 'card',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="alarm"
          options={{
            presentation: 'fullScreenModal',
            animation: 'fade',
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="details/[id]"
          options={{
            presentation: 'card',
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="permissions-guide"
          options={{
            presentation: 'card',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="delete-account"
          options={{
            presentation: 'card',
            animation: 'slide_from_right',
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <FeedbackProvider>
          <AuthProvider>
            <CaregiverProvider>
              <RootLayoutNav />
            </CaregiverProvider>
          </AuthProvider>
        </FeedbackProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
