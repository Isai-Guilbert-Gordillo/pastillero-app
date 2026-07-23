import { useAppAlert } from '@/components/AppAlert';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import IconBadge from '@/components/ui/IconBadge';
import { BORDER_RADIUS, COLORS, FONTS, GRADIENTS, SPACING } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const PACKAGE_URI = 'package:com.pastilleroapp.app';
const PREVIEW_DURATION_MS = 3000;

export default function PermissionsGuideScreen() {
  const router = useRouter();
  const { alert } = useAppAlert();
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
      alert('No se pudo reproducir', 'No se pudo escuchar el sonido de la alarma en este dispositivo.');
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
      alert('✅ ¡Listo!', 'Ya se configuraron los permisos. Si tu teléfono mostró alguna pantalla adicional, solo tenías que tocar "Permitir".');
    } finally {
      setRequesting(false);
    }
  };

  const openAppSettingsScreen = () => {
    Linking.openSettings().catch(() => {});
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <LinearGradient colors={GRADIENTS.primary} style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={28} color={COLORS.white} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerEmoji}>🔒</Text>
          <Text style={styles.headerTitle}>Activar alarmas</Text>
          <Text style={styles.headerSubtitle}>
            Un solo paso para que la alarma nunca falle
          </Text>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Tarjeta principal — un solo botón hace todo */}
        <Card style={styles.mainCard}>
          <IconBadge name="notifications" color={COLORS.primary} backgroundColor={COLORS.primaryBg} size={72} iconSize={34} />
          <Text style={styles.mainTitle}>Toca el botón</Text>
          <Text style={styles.mainDescription}>
            Van a aparecer 2 o 3 ventanas de tu teléfono preguntando permiso.{'\n'}
            Solo toca <Text style={styles.bold}>"Permitir"</Text> en cada una.
          </Text>

          <Button
            title={requestedAll ? 'Volver a activar' : 'Activar todo'}
            icon={requestedAll ? 'refresh' : 'shield-checkmark'}
            onPress={activateEverything}
            loading={requesting}
            style={styles.activateButton}
          />

          <View style={styles.statusRow}>
            <Ionicons
              name={notifGranted ? 'checkmark-circle' : 'ellipse-outline'}
              size={22}
              color={notifGranted ? COLORS.success : COLORS.textLight}
            />
            <Text style={[styles.statusText, notifGranted && styles.statusTextDone]}>
              Notificaciones {notifGranted ? 'activadas' : 'pendientes'}
            </Text>
          </View>
          {requestedAll && (
            <View style={styles.statusRow}>
              <Ionicons name="checkmark-circle" size={22} color={COLORS.success} />
              <Text style={[styles.statusText, styles.statusTextDone]}>
                Batería y alarmas configuradas
              </Text>
            </View>
          )}
        </Card>

        {/* Escuchar cómo suena la alarma antes de que sea real */}
        <Card style={styles.previewCard}>
          <View style={styles.extraHeader}>
            <IconBadge name="volume-high" color={COLORS.warning} backgroundColor={COLORS.warningLight} size={40} iconSize={20} />
            <Text style={styles.extraTitle}>¿Cómo suena la alarma?</Text>
          </View>
          <Text style={styles.extraText}>
            Escúchala ahora para que no te tome por sorpresa la primera vez.
          </Text>
          <TouchableOpacity
            style={[styles.extraButton, previewing && styles.previewButtonActive]}
            onPress={handlePreviewSound}
            activeOpacity={0.7}
          >
            <Text style={[styles.extraButtonText, previewing && styles.previewButtonTextActive]}>
              {previewing ? 'Detener' : 'Escuchar sonido'}
            </Text>
            <Ionicons
              name={previewing ? 'stop-circle' : 'play-circle-outline'}
              size={20}
              color={previewing ? COLORS.white : COLORS.secondary}
            />
          </TouchableOpacity>
        </Card>

        {/* Nota para teléfonos con restricciones extra (Xiaomi, Samsung, etc.) */}
        <Card style={styles.extraCard}>
          <View style={styles.extraHeader}>
            <IconBadge name="phone-portrait" color={COLORS.secondary} backgroundColor={COLORS.secondaryLight} size={40} iconSize={20} />
            <Text style={styles.extraTitle}>¿Xiaomi, Redmi, Samsung o Huawei?</Text>
          </View>
          <Text style={styles.extraText}>
            Algunas marcas tienen un ajuste extra llamado "Inicio automático" que no se puede
            abrir directamente. Es mejor que lo configure un familiar una sola vez:
          </Text>
          <Text style={styles.extraSteps}>
            Ajustes del teléfono → Apps → PastilleroApp → Permisos → activar "Inicio automático"
          </Text>
          <TouchableOpacity style={styles.extraButton} onPress={openAppSettingsScreen} activeOpacity={0.7}>
            <Text style={styles.extraButtonText}>Abrir ajustes de la app</Text>
            <Ionicons name="open-outline" size={20} color={COLORS.secondary} />
          </TouchableOpacity>
        </Card>

        {/* Botón: Ya terminé */}
        <TouchableOpacity
          style={styles.doneButton}
          onPress={() => {
            if (!notifGranted) {
              alert(
                '⚠️ Falta un permiso importante',
                'Las notificaciones no están activadas. Sin ellas la app NO podrá avisarte de tus medicamentos.',
                [
                  { text: 'Activar ahora', onPress: activateEverything },
                  { text: 'Continuar sin activar', onPress: () => router.back(), style: 'destructive' },
                ]
              );
            } else {
              router.back();
            }
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="checkmark-done-circle" size={32} color={COLORS.white} />
          <Text style={styles.doneButtonText}>YA TERMINÉ</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingBottom: SPACING.lg,
    borderBottomLeftRadius: BORDER_RADIUS.xl,
    borderBottomRightRadius: BORDER_RADIUS.xl,
  },
  backButton: {
    position: 'absolute',
    top: SPACING.md,
    left: SPACING.md,
    zIndex: 10,
    padding: SPACING.sm,
  },
  headerContent: {
    alignItems: 'center',
    paddingTop: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  headerEmoji: {
    fontSize: 48,
    marginBottom: SPACING.sm,
  },
  headerTitle: {
    fontSize: FONTS.sizeTitle,
    fontFamily: FONTS.family.extraBold,
    color: COLORS.white,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: FONTS.sizeMedium,
    fontFamily: FONTS.family.medium,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginTop: SPACING.sm,
    lineHeight: 28,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
  },
  bold: {
    fontFamily: FONTS.family.bold,
    color: COLORS.text,
  },
  // ─── Tarjeta principal ───
  mainCard: {
    alignItems: 'center',
    marginBottom: SPACING.md,
    paddingVertical: SPACING.xl,
  },
  mainTitle: {
    fontSize: FONTS.sizeXLarge,
    fontFamily: FONTS.family.bold,
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  mainDescription: {
    fontSize: FONTS.sizeMedium,
    fontFamily: FONTS.family.regular,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 28,
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  activateButton: {
    width: '100%',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  statusText: {
    fontSize: FONTS.sizeMedium,
    fontFamily: FONTS.family.semiBold,
    color: COLORS.textLight,
  },
  statusTextDone: {
    color: COLORS.success,
  },
  // ─── Nota OEM ───
  extraCard: {
    marginBottom: SPACING.lg,
  },
  previewCard: {
    marginBottom: SPACING.md,
  },
  previewButtonActive: {
    backgroundColor: COLORS.secondary,
  },
  previewButtonTextActive: {
    color: COLORS.white,
  },
  extraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  extraTitle: {
    flex: 1,
    fontSize: FONTS.sizeMedium,
    fontFamily: FONTS.family.bold,
    color: COLORS.text,
  },
  extraText: {
    fontSize: FONTS.sizeSmall,
    fontFamily: FONTS.family.regular,
    color: COLORS.textSecondary,
    lineHeight: 24,
    marginBottom: SPACING.sm,
  },
  extraSteps: {
    fontSize: FONTS.sizeSmall,
    fontFamily: FONTS.family.semiBold,
    color: COLORS.secondary,
    backgroundColor: COLORS.secondaryLight,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm + 4,
    lineHeight: 22,
    marginBottom: SPACING.md,
  },
  extraButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    borderWidth: 1.5,
    borderColor: COLORS.secondary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm + 4,
  },
  extraButtonText: {
    fontSize: FONTS.sizeSmall,
    fontFamily: FONTS.family.bold,
    color: COLORS.secondary,
  },
  // ─── Botón final ───
  doneButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    minHeight: 80,
    elevation: 4,
  },
  doneButtonText: {
    fontSize: FONTS.sizeXLarge,
    fontFamily: FONTS.family.extraBold,
    color: COLORS.white,
  },
});
