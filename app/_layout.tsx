import { AppAlertProvider } from '@/components/AppAlert';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { CaregiverProvider } from '@/context/CaregiverContext';
import { registerForPushNotifications, setupNotificationCategories, snoozeAlarm } from '@/lib/notifications';
import { COLORS } from '@/lib/theme';
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

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const navigationReady = useRef(false);
  const lastHandledMedDose = useRef<string>(''); // evitar doble nav por medicationId+scheduledAt

  useEffect(() => {
    registerForPushNotifications();
    setupNotificationCategories();
    // Dar tiempo a que el Stack se monte antes de marcar ready
    const timer = setTimeout(() => {
      navigationReady.current = true;
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // ─── Detectar cuando la app vuelve al primer plano ───
  // Si hay notificaciones ALARM pendientes, navegar automáticamente a /alarm
  useEffect(() => {
    const handleAppStateChange = async (nextState: AppStateStatus) => {
      if (nextState === 'active' && navigationReady.current) {
        try {
          const presented = await Notifications.getPresentedNotificationsAsync();
          for (const notif of presented) {
            const data = notif.request.content.data;
            if (data?.medicationId && data?.type === 'ALARM') {
              console.log('🔔 App volvió al foreground con alarma pendiente');
              navigateToAlarm(data, notif.request.identifier);
              // Limpiar la notificación del sistema ya que estamos abriendo la alarma
              Notifications.dismissNotificationAsync(notif.request.identifier).catch(() => {});
              break;
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
          navigateToAlarm(
            { medicationId: String(medicationId), type: 'ALARM', scheduledAt: scheduledAt ? String(scheduledAt) : '' },
            'deeplink'
          );
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

  // Helper: navegar a AlarmScreen deduplicando por medicamento+dosis
  const navigateToAlarm = (data: Record<string, unknown>, _notifId: string) => {
    if (!navigationReady.current) return;
    
    // Deduplicar por medicationId + scheduledAt (no por notifId)
    // Así la primera notificación abre la alarma, y los recordatorios NO abren duplicados
    const dedupeKey = `${data.medicationId}_${data.scheduledAt || ''}`;
    if (lastHandledMedDose.current === dedupeKey) return;
    lastHandledMedDose.current = dedupeKey;

    // Limpiar el dedupeKey después de 15 min para permitir futuras dosis del mismo med
    setTimeout(() => {
      if (lastHandledMedDose.current === dedupeKey) {
        lastHandledMedDose.current = '';
      }
    }, 15 * 60 * 1000);

    // NO iniciar alarma aquí — AlarmScreen lo hace en su useEffect
    router.push({
      pathname: '/alarm',
      params: {
        medicationId: String(data.medicationId),
        scheduledAt: data.scheduledAt ? String(data.scheduledAt) : '',
      },
    });
  };

  // ─── Observador global: notificación recibida en PRIMER PLANO ───
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data;
      if (data?.medicationId && data?.type === 'ALARM') {
        console.log('🔔 Notificación ALARM recibida en foreground');
        navigateToAlarm(data, notification.request.identifier);
      }
    });
    return () => subscription.remove();
  }, []);

  // ─── Observador global: usuario TOCA la notificación o un botón de acción ───
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const data = response.notification.request.content.data;
      const actionId = response.actionIdentifier;

      if (!data?.medicationId) return;

      // Si tocó "Recordar en 5 min" → cancelar recordatorios actuales y reprogramar
      if (actionId === 'SNOOZE') {
        console.log('⏰ Snooze — reprogramando en 5 min');
        if (data.medicationId) {
          const scheduledAt = data.scheduledAt ? String(data.scheduledAt) : undefined;
          await snoozeAlarm(String(data.medicationId), data, scheduledAt);
          // Limpiar dedup para que la nueva notificación pueda navegar
          lastHandledMedDose.current = '';
        }
        return;
      }

      // Cualquier otra acción (tap, TAKE_MEDICINE) → abrir AlarmScreen
      console.log('🔔 Notificación tocada — abriendo AlarmScreen');
      navigateToAlarm(data, response.notification.request.identifier);
    });
    return () => subscription.remove();
  }, []);

  // ─── Detectar notificación que abrió la app (cold start) ───
  useEffect(() => {
    if (Platform.OS === 'web') return;
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const data = response.notification.request.content.data;
      if (data?.medicationId) {
        // Esperar a que la navegación esté lista
        const timer = setTimeout(() => {
          navigateToAlarm(data, response.notification.request.identifier);
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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="alarm"
        options={{
          headerShown: false,
          presentation: 'fullScreenModal',
          animation: 'fade',
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="details/[id]"
        options={{
          headerShown: false,
          presentation: 'card',
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="permissions-guide"
        options={{
          headerShown: false,
          presentation: 'card',
          animation: 'slide_from_bottom',
        }}
      />
    </Stack>
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
    <AppAlertProvider>
      <AuthProvider>
        <CaregiverProvider>
          <RootLayoutNav />
          <StatusBar style="dark" />
        </CaregiverProvider>
      </AuthProvider>
    </AppAlertProvider>
  );
}
