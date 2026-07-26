import { Ionicons } from '@expo/vector-icons';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Text from '@/components/ui/Text';
import { useTheme } from '@/context/ThemeContext';
import {
  MOTION,
  NAV_BAR_HEIGHT,
  SCREEN_MARGIN,
  SHAPE,
  SPACING,
  STATE_LAYER,
  TOUCH,
  elevation,
  withAlpha,
} from '@/lib/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Sistema de retroalimentación de Material 3 — tres canales, tres trabajos.
//
// Antes TODO pasaba por un único modal genérico: confirmar una dosis, elegir
// entre cámara y galería, avisar de un error de red y pedir confirmación para
// borrar usaban exactamente la misma ventana. Un modal para algo que no necesita
// interrumpir enseña al usuario a cerrar modales sin leerlos, y entonces el
// modal que SÍ importaba tampoco se lee.
//
//   · snack()   — algo que YA pasó. No interrumpe. 4s sobre la barra de navegación.
//   · sheet()   — elegir entre opciones equivalentes. Hoja inferior arrastrable.
//   · alert()   — una decisión que DEBE interrumpir: destructiva o irreversible.
// ─────────────────────────────────────────────────────────────────────────────

export interface DialogButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface SheetOption {
  label: string;
  description?: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  destructive?: boolean;
}

export type SnackTone = 'default' | 'success' | 'error';

interface FeedbackContextValue {
  /** Diálogo modal. Solo para decisiones que deben interrumpir. */
  alert: (title: string, message?: string, buttons?: DialogButton[]) => void;
  /** Confirmación transitoria de algo que ya ocurrió. */
  snack: (message: string, options?: { tone?: SnackTone; action?: { label: string; onPress: () => void } }) => void;
  /** Elección entre opciones equivalentes. */
  sheet: (title: string, options: SheetOption[]) => void;
}

const FeedbackContext = createContext<FeedbackContextValue>({
  alert: () => {},
  snack: () => {},
  sheet: () => {},
});

// ═══════════════════════════════════════════════════════════════════════════
// Diálogo
// ═══════════════════════════════════════════════════════════════════════════

interface DialogState {
  visible: boolean;
  title: string;
  message?: string;
  buttons: DialogButton[];
}

function Dialog({ state, onDismiss }: { state: DialogState; onDismiss: () => void }) {
  const { scheme } = useTheme();

  const handle = (button: DialogButton) => {
    onDismiss();
    button.onPress?.();
  };

  // Material apila las acciones cuando no caben en una línea. Con rótulos como
  // "El doctor lo extendió" eso es casi siempre, así que el umbral es explícito.
  const stacked =
    state.buttons.length > 2 || state.buttons.some((b) => b.text.length > 14);

  return (
    <Modal visible={state.visible} transparent animationType="none" onRequestClose={onDismiss} statusBarTranslucent>
      <Animated.View
        entering={FadeIn.duration(MOTION.duration.short)}
        exiting={FadeOut.duration(MOTION.duration.short)}
        style={[styles.scrim, { backgroundColor: scheme.scrim }]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} accessibilityLabel="Cerrar" />

        <Animated.View
          entering={FadeIn.duration(MOTION.duration.medium)}
          style={[
            styles.dialog,
            { backgroundColor: scheme.surface },
            elevation(4, scheme),
          ]}
        >
          <Text variant="headlineSmall" style={styles.dialogTitle}>
            {state.title}
          </Text>
          {!!state.message && (
            <Text variant="bodyMedium" tone="variant" style={styles.dialogMessage}>
              {state.message}
            </Text>
          )}

          <View style={[styles.dialogActions, stacked && styles.dialogActionsStacked]}>
            {state.buttons.map((button, index) => (
              <Pressable
                key={`${button.text}-${index}`}
                accessibilityRole="button"
                onPress={() => handle(button)}
                style={({ pressed }) => [
                  styles.dialogButton,
                  stacked && styles.dialogButtonStacked,
                  pressed && {
                    backgroundColor: withAlpha(
                      button.style === 'destructive' ? scheme.error : scheme.primary,
                      STATE_LAYER.pressed
                    ),
                  },
                ]}
              >
                <Text
                  variant="labelLarge"
                  color={
                    button.style === 'destructive'
                      ? scheme.error
                      : button.style === 'cancel'
                        ? scheme.onSurfaceVariant
                        : scheme.primary
                  }
                >
                  {button.text}
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Hoja inferior
// ═══════════════════════════════════════════════════════════════════════════

interface SheetState {
  visible: boolean;
  title: string;
  options: SheetOption[];
}

function BottomSheet({ state, onDismiss }: { state: SheetState; onDismiss: () => void }) {
  const { scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(0);

  useEffect(() => {
    if (state.visible) translateY.value = 0;
  }, [state.visible]);

  // La manija de arrastre no es un adorno: arrastra de verdad. Una manija que
  // se ve arrastrable y no lo es enseña a desconfiar del resto de la interfaz.
  const pan = Gesture.Pan()
    .onChange((e) => {
      translateY.value = Math.max(0, translateY.value + e.changeY);
    })
    .onEnd((e) => {
      if (translateY.value > 120 || e.velocityY > 800) {
        translateY.value = withTiming(600, { duration: MOTION.duration.medium }, () => {
          runOnJS(onDismiss)();
        });
      } else {
        translateY.value = withTiming(0, {
          duration: MOTION.duration.medium,
          easing: Easing.bezier(...MOTION.easing.emphasizedDecelerate),
        });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  const handle = (option: SheetOption) => {
    onDismiss();
    option.onPress();
  };

  return (
    <Modal visible={state.visible} transparent animationType="slide" onRequestClose={onDismiss} statusBarTranslucent>
      <View style={[styles.scrim, styles.scrimBottom, { backgroundColor: scheme.scrim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} accessibilityLabel="Cerrar" />

        <GestureDetector gesture={pan}>
          <Animated.View
            style={[
              styles.sheet,
              {
                backgroundColor: scheme.surface,
                paddingBottom: insets.bottom + SPACING.lg,
              },
              elevation(4, scheme),
              sheetStyle,
            ]}
          >
            <View style={[styles.grabber, { backgroundColor: scheme.outlineVariant }]} />

            <Text variant="titleLarge" style={styles.sheetTitle}>
              {state.title}
            </Text>

            {state.options.map((option) => (
              <Pressable
                key={option.label}
                accessibilityRole="button"
                accessibilityLabel={option.description ? `${option.label}. ${option.description}` : option.label}
                onPress={() => handle(option)}
                style={({ pressed }) => [
                  styles.sheetOption,
                  pressed && {
                    backgroundColor: withAlpha(scheme.onSurface, STATE_LAYER.pressed),
                  },
                ]}
              >
                <Ionicons
                  name={option.icon}
                  size={28}
                  color={option.destructive ? scheme.error : scheme.onSurfaceVariant}
                />
                <View style={styles.sheetOptionText}>
                  <Text variant="titleSmall" color={option.destructive ? scheme.error : undefined}>
                    {option.label}
                  </Text>
                  {!!option.description && (
                    <Text variant="bodySmall" tone="variant">
                      {option.description}
                    </Text>
                  )}
                </View>
              </Pressable>
            ))}
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Snackbar
// ═══════════════════════════════════════════════════════════════════════════

interface SnackState {
  visible: boolean;
  message: string;
  tone: SnackTone;
  action?: { label: string; onPress: () => void };
}

function Snackbar({ state, onDismiss }: { state: SnackState; onDismiss: () => void }) {
  const { scheme } = useTheme();
  const insets = useSafeAreaInsets();

  if (!state.visible) return null;

  const background =
    state.tone === 'error' ? scheme.errorContainer
    : state.tone === 'success' ? scheme.successContainer
    : scheme.inverseSurface;
  const content =
    state.tone === 'error' ? scheme.onErrorContainer
    : state.tone === 'success' ? scheme.onSuccessContainer
    : scheme.onInverseSurface;
  const actionColor = state.tone === 'default' ? scheme.inversePrimary : content;

  return (
    <Animated.View
      entering={FadeIn.duration(MOTION.duration.medium)}
      exiting={FadeOut.duration(MOTION.duration.short)}
      pointerEvents="box-none"
      style={[
        styles.snackWrap,
        { bottom: insets.bottom + NAV_BAR_HEIGHT + SPACING.sm },
      ]}
    >
      <View
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        style={[styles.snack, { backgroundColor: background }, elevation(3, scheme)]}
      >
        <Text variant="bodyMedium" color={content} style={styles.snackText}>
          {state.message}
        </Text>
        {state.action && (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              onDismiss();
              state.action?.onPress();
            }}
            style={styles.snackAction}
            hitSlop={8}
          >
            <Text variant="labelLarge" color={actionColor}>
              {state.action.label}
            </Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Provider
// ═══════════════════════════════════════════════════════════════════════════

const NO_DIALOG: DialogState = { visible: false, title: '', buttons: [] };
const NO_SHEET: SheetState = { visible: false, title: '', options: [] };
const NO_SNACK: SnackState = { visible: false, message: '', tone: 'default' };

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<DialogState>(NO_DIALOG);
  const [sheetState, setSheetState] = useState<SheetState>(NO_SHEET);
  const [snackState, setSnackState] = useState<SnackState>(NO_SNACK);
  const snackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const alert = useCallback((title: string, message?: string, buttons?: DialogButton[]) => {
    setDialog({
      visible: true,
      title,
      message,
      buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'Entendido' }],
    });
  }, []);

  const snack = useCallback<FeedbackContextValue['snack']>((message, options) => {
    if (snackTimer.current) clearTimeout(snackTimer.current);
    setSnackState({
      visible: true,
      message,
      tone: options?.tone ?? 'default',
      action: options?.action,
    });
    // Material: 4s sin acción, 6s con acción (hay algo que leer y decidir).
    snackTimer.current = setTimeout(
      () => setSnackState(NO_SNACK),
      options?.action ? 6000 : 4000
    );
  }, []);

  const sheet = useCallback((title: string, options: SheetOption[]) => {
    setSheetState({ visible: true, title, options });
  }, []);

  useEffect(() => () => {
    if (snackTimer.current) clearTimeout(snackTimer.current);
  }, []);

  return (
    <FeedbackContext.Provider value={{ alert, snack, sheet }}>
      {children}
      <Dialog state={dialog} onDismiss={() => setDialog((s) => ({ ...s, visible: false }))} />
      <BottomSheet state={sheetState} onDismiss={() => setSheetState((s) => ({ ...s, visible: false }))} />
      <Snackbar state={snackState} onDismiss={() => setSnackState(NO_SNACK)} />
    </FeedbackContext.Provider>
  );
}

export const useFeedback = () => useContext(FeedbackContext);

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SCREEN_MARGIN,
  },
  scrimBottom: {
    justifyContent: 'flex-end',
    padding: 0,
  },
  // ─── Diálogo ───
  dialog: {
    width: '100%',
    maxWidth: 420,
    borderRadius: SHAPE.extraLarge,
    padding: SPACING.xl,
  },
  dialogTitle: {
    marginBottom: SPACING.md,
  },
  dialogMessage: {
    marginBottom: SPACING.xl,
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  dialogActionsStacked: {
    flexDirection: 'column-reverse',
    alignItems: 'stretch',
  },
  dialogButton: {
    minHeight: TOUCH.min,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    borderRadius: SHAPE.full,
  },
  dialogButtonStacked: {
    alignItems: 'flex-end',
  },
  // ─── Hoja inferior ───
  sheet: {
    borderTopLeftRadius: SHAPE.extraLarge,
    borderTopRightRadius: SHAPE.extraLarge,
    paddingHorizontal: SPACING.sm,
    paddingTop: SPACING.md,
  },
  grabber: {
    width: 48,
    height: 4,
    borderRadius: SHAPE.full,
    alignSelf: 'center',
    marginBottom: SPACING.lg,
  },
  sheetTitle: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.lg,
    minHeight: TOUCH.primary,
    paddingHorizontal: SPACING.lg,
    borderRadius: SHAPE.medium,
  },
  sheetOptionText: {
    flex: 1,
  },
  // ─── Snackbar ───
  snackWrap: {
    position: 'absolute',
    left: SCREEN_MARGIN,
    right: SCREEN_MARGIN,
  },
  snack: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    borderRadius: SHAPE.extraSmall,
    paddingVertical: SPACING.md,
    paddingLeft: SPACING.lg,
    paddingRight: SPACING.sm,
    gap: SPACING.sm,
  },
  snackText: {
    flex: 1,
  },
  snackAction: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
  },
});
