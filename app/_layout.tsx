import { AuthProvider, useAuth } from '@/context/AuthContext';
import { registerForPushNotifications } from '@/lib/notifications';
import { COLORS } from '@/lib/theme';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const navigationReady = useRef(false);
  const lastHandledNotifId = useRef<string>(''); // evitar doble nav

  useEffect(() => {
    registerForPushNotifications();
    // Dar tiempo a que el Stack se monte antes de marcar ready
    const timer = setTimeout(() => {
      navigationReady.current = true;
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Helper: navegar a AlarmScreen deduplicando
  const navigateToAlarm = (data: Record<string, unknown>, notifId: string) => {
    if (!navigationReady.current) return;
    if (lastHandledNotifId.current === notifId) return; // ya manejada
    lastHandledNotifId.current = notifId;

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

  // ─── Observador global: usuario TOCA la notificación (background/cerrada) ───
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.medicationId) {
        console.log('🔔 Notificación tocada — abriendo AlarmScreen');
        navigateToAlarm(data, response.notification.request.identifier);
      }
    });
    return () => subscription.remove();
  }, []);

  // ─── Detectar notificación que abrió la app (cold start) ───
  useEffect(() => {
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
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
      <StatusBar style="dark" />
    </AuthProvider>
  );
}
