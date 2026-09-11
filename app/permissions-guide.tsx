import DonMemo from '@/components/DonMemo';
import { useFeedback } from '@/components/Feedback';
import Button from '@/components/ui/Button';
import IconBadge from '@/components/ui/IconBadge';
import Surface from '@/components/ui/Surface';
import Text from '@/components/ui/Text';
import TopAppBar from '@/components/ui/TopAppBar';
import { useTheme, useThemedStyles } from '@/context/ThemeContext';
import { ColorScheme, SCREEN_MARGIN, SHAPE, SPACING, elevation } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─────────────────────────────────────────────────────────────────────────────
// Guía de permisos.
//
// Es una pantalla de configuración que se abre en el primer inicio de sesión, y
// por eso su forma es una LISTA DE PASOS con estado —no tres tarjetas sueltas.
// Cada paso muestra si ya está hecho con forma y color a la vez (palomita en
// contenedor verde / círculo vacío), igual que el semáforo de dosis, para que
// "¿ya quedó?" se responda sin leer.
//
// La acción principal vive en una barra fija abajo: es la única cosa que esta
// pantalla necesita que pase.
// ─────────────────────────────────────────────────────────────────────────────

const PACKAGE_URI = 'package:com.pastilleroapp.app';
const PREVIEW_DURATION_MS = 3000;

export default function PermissionsGuideScreen() {
  const router = useRouter();
  const { scheme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { alert, snack } = useFeedback();

  const [notifGranted, setNotifGranted] = useState<boolean | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [requestedAll, setRequestedAll] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const previewSoundRef = useRef<Audio.Sound | null>(null);

  const stopPreview = useCallback(async () => {
    setPreviewing(false);
    const sound = previewSoundRef.current;
    previewSoundRef.current = null;
    if (sound) {
      try {
        await sound.stopAsync();
        await sound.unloadAsync();
      } catch (e) {
        console.log('Error deteniendo vista previa:', e);
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      stopPreview();
    };
  }, [stopPreview]);

  const handlePreviewSound = async () => {
    if (previewing) {
      await stopPreview();
      return;
    }
    setPreviewing(true);
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('../assets/alarm_sound.wav'),
        { shouldPlay: true, isLooping: true, volume: 1.0 }
      );
      previewSoundRef.current = sound;
      setTimeout(() => {
        // Solo detener si sigue siendo esta misma vista previa (no se canceló antes)
        if (previewSoundRef.current === sound) stopPreview();
      }, PREVIEW_DURATION_MS);
    } catch (e) {
      console.log('Error reproduciendo vista previa:', e);
      setPreviewing(false);
      snack('No se pudo reproducir el sonido en este dispositivo.', { tone: 'error' });
    }
  };

  const checkNotifications = useCallback(async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      setNotifGranted(status === 'granted');
    } catch (e) {
      console.log('Error checking notifications:', e);
    }
  }, []);

  useEffect(() => {
    checkNotifications();
  }, [checkNotifications]);

  // Cuando la app vuelve al primer plano tras un ajuste, re-verificar
  useEffect(() => {
    const interval = setInterval(checkNotifications, 3000);
    return () => clearInterval(interval);
  }, [checkNotifications]);

  // ─── Un solo flujo: pide los 3 permisos en cadena, cada uno con un diálogo directo del sistema ───
  const activateEverything = async () => {
    if (requesting) return;
    setRequesting(true);
    try {
      // 1. Notificaciones — diálogo estándar "Permitir / No permitir"
      await Notifications.requestPermissionsAsync();
      await checkNotifications();

      if (Platform.OS === 'android') {
        // 2. Batería sin restricciones — un solo diálogo del sistema, sin ir a Ajustes
        try {
          await IntentLauncher.startActivityAsync(
            IntentLauncher.ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
            { data: PACKAGE_URI }
          );
        } catch (e) {
          console.log('Battery optimization request skipped:', e);
        }

        // 3. Alarmas exactas (Android 12+) — igual, un solo diálogo directo
        try {
          await IntentLauncher.startActivityAsync(
            IntentLauncher.ActivityAction.REQUEST_SCHEDULE_EXACT_ALARM,
            { data: PACKAGE_URI }
          );
        } catch (e) {
          console.log('Exact alarm request skipped (Android < 12 probablemente):', e);
        }
      }

      setRequestedAll(true);
      snack('Permisos configurados. Tus alarmas ya pueden sonar.', { tone: 'success' });
    } finally {
      setRequesting(false);
    }
  };

  const handleDone = () => {
    if (!notifGranted) {
      alert(
        'Falta un permiso importante',
        'Sin el permiso de notificaciones la app no va a poder avisarte de tus medicamentos.',
        [
          { text: 'Activar ahora', onPress: activateEverything },
          { text: 'Continuar sin activar', style: 'destructive', onPress: () => router.back() },
        ]
      );
      return;
    }
    router.back();
  };

  const steps: { done: boolean; title: string; detail: string }[] = [
    {
      done: notifGranted === true,
      title: 'Notificaciones',
      detail: 'Para que la app pueda avisarte cuando toca una dosis.',
    },
    {
      done: requestedAll,
      title: 'Batería sin restricciones',
      detail: 'Para que el teléfono no apague la app mientras espera la hora.',
    },
    {
      done: requestedAll,
      title: 'Alarmas exactas',
      detail: 'Para que suene a la hora justa y no unos minutos después.',
    },
  ];

  return (
    <View style={styles.container}>
      <TopAppBar
        title="Activar las alarmas"
        subtitle="Un solo paso para que nunca falle"
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Don Memo explica por qué ───
            Era una pantalla de configuración árida: tres permisos del sistema
            y nada que explicara para qué. Aquí sí habla en primera persona —
            está explicando cómo funciona la app, no dando ninguna indicación
            médica. */}
        <View style={styles.intro}>
          <DonMemo size={62} variant="head" gesture="greet" />
          <Text variant="bodyMedium" tone="variant" style={styles.introText}>
            Para avisarte a tiempo necesito que me des permiso en tres cosas.
            Te acompaño paso por paso.
          </Text>
        </View>

        {/* ─── Los tres permisos, con su estado ─── */}
        <Text variant="labelMedium" tone="variant" style={styles.groupLabel}>
          LO QUE HAY QUE PERMITIR
        </Text>
        <Surface level={1} padded>
          {steps.map((step, index) => (
            <View key={step.title} style={[styles.step, index > 0 && styles.stepGap]}>
              <View
                style={[
                  styles.stepMark,
                  { backgroundColor: step.done ? scheme.successContainer : scheme.surfaceVariant },
                ]}
              >
                <Ionicons
                  name={step.done ? 'checkmark' : 'ellipse-outline'}
                  size={24}
                  color={step.done ? scheme.onSuccessContainer : scheme.onSurfaceVariant}
                />
              </View>
              <View style={styles.flex}>
                <Text variant="titleSmall">{step.title}</Text>
                <Text variant="bodySmall" tone="variant">
                  {step.detail}
                </Text>
                <Text
                  variant="labelSmall"
                  color={step.done ? scheme.success : scheme.onSurfaceMuted}
                  style={styles.stepState}
                >
                  {step.done ? 'Listo' : 'Pendiente'}
                </Text>
              </View>
            </View>
          ))}

          <Text variant="bodySmall" tone="variant" style={styles.stepsHint}>
            Al tocar el botón van a aparecer 2 o 3 ventanas del teléfono. En todas hay que tocar
            &quot;Permitir&quot;.
          </Text>
        </Surface>

        {/* ─── Escuchar la alarma antes de que sea real ─── */}
        <Text variant="labelMedium" tone="variant" style={styles.groupLabel}>
          ANTES DE EMPEZAR
        </Text>
        <Surface level={1} padded style={styles.group}>
          <View style={styles.cardHeader}>
            <IconBadge
              name="volume-high"
              color={scheme.onWarningContainer}
              backgroundColor={scheme.warningContainer}
              size={48}
            />
            <View style={styles.flex}>
              <Text variant="titleSmall">¿Cómo suena la alarma?</Text>
              <Text variant="bodySmall" tone="variant">
                Escúchala ahora para que no te sorprenda la primera vez.
              </Text>
            </View>
          </View>
          <Button
            title={previewing ? 'Detener el sonido' : 'Escuchar el sonido'}
            icon={previewing ? 'stop-circle' : 'play-circle-outline'}
            variant={previewing ? 'tonal' : 'outlined'}
            onPress={handlePreviewSound}
            style={styles.cardAction}
          />
        </Surface>

        {/* ─── Nota para teléfonos con restricciones extra ─── */}
        <Surface level={1} padded style={styles.group}>
          <View style={styles.cardHeader}>
            <IconBadge
              name="phone-portrait"
              color={scheme.secondary}
              backgroundColor={scheme.secondaryContainer}
              size={48}
            />
            <View style={styles.flex}>
              <Text variant="titleSmall">¿Xiaomi, Redmi, Samsung o Huawei?</Text>
              <Text variant="bodySmall" tone="variant">
                Estas marcas tienen un ajuste extra que no se puede abrir desde aquí. Es mejor que lo
                configure un familiar una sola vez.
              </Text>
            </View>
          </View>

          <View style={[styles.path, { backgroundColor: scheme.surfaceContainer }]}>
            <Text variant="labelSmall" tone="variant">
              RUTA EN LOS AJUSTES
            </Text>
            <Text variant="bodySmall" style={styles.pathText}>
              Ajustes → Apps → PastilleroApp → Permisos → activar &quot;Inicio automático&quot;
            </Text>
          </View>

          <Button
            title="Abrir ajustes de la app"
            icon="open-outline"
            iconTrailing
            variant="outlined"
            onPress={() => Linking.openSettings().catch(() => {})}
            style={styles.cardAction}
          />
        </Surface>
      </ScrollView>

      {/* La única acción que esta pantalla necesita, siempre alcanzable. */}
      <View
        style={[
          styles.actionBar,
          {
            backgroundColor: scheme.surfaceContainer,
            borderTopColor: scheme.outlineVariant,
            paddingBottom: insets.bottom + SPACING.lg,
          },
          elevation(2, scheme),
        ]}
      >
        <Button
          title={requestedAll ? 'Volver a activar' : 'Activar todo'}
          icon={requestedAll ? 'refresh' : 'shield-checkmark'}
          emphasis
          loading={requesting}
          onPress={activateEverything}
        />
        <Button title="Ya terminé" variant="text" onPress={handleDone} style={styles.doneButton} />
      </View>
    </View>
  );
}

const makeStyles = (t: ColorScheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.background,
    },
    flex: {
      flex: 1,
    },
    scroll: {
      paddingHorizontal: SCREEN_MARGIN,
      paddingBottom: SPACING.xxl,
    },
    intro: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.lg,
      marginTop: SPACING.sm,
    },
    introText: {
      flex: 1,
    },
    groupLabel: {
      marginTop: SPACING.xl,
      marginBottom: SPACING.md,
    },
    group: {
      marginBottom: SPACING.md,
    },
    // ─── Pasos ───
    step: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.lg,
    },
    stepGap: {
      marginTop: SPACING.xl,
    },
    stepMark: {
      width: 48,
      height: 48,
      borderRadius: SHAPE.full,
      justifyContent: 'center',
      alignItems: 'center',
    },
    stepState: {
      marginTop: SPACING.xs,
    },
    stepsHint: {
      marginTop: SPACING.xl,
    },
    // ─── Tarjetas ───
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.lg,
    },
    cardAction: {
      marginTop: SPACING.lg,
    },
    path: {
      borderRadius: SHAPE.medium,
      padding: SPACING.lg,
      marginTop: SPACING.lg,
    },
    pathText: {
      marginTop: SPACING.xs,
    },
    // ─── Barra de acción ───
    actionBar: {
      paddingHorizontal: SCREEN_MARGIN,
      paddingTop: SPACING.lg,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    doneButton: {
      marginTop: SPACING.xs,
    },
  });
