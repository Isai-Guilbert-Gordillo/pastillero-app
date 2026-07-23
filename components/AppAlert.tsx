import React, { createContext, useCallback, useContext, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { BORDER_RADIUS, COLORS, FONTS, SHADOWS, SPACING, TOUCH_TARGET } from '@/lib/theme';

export interface AppAlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface AlertContextType {
  alert: (title: string, message?: string, buttons?: AppAlertButton[]) => void;
}

const AlertContext = createContext<AlertContextType>({ alert: () => {} });

interface AlertState {
  visible: boolean;
  title: string;
  message?: string;
  buttons: AppAlertButton[];
}

const DEFAULT_STATE: AlertState = { visible: false, title: '', buttons: [] };

export function AppAlertProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AlertState>(DEFAULT_STATE);

  const alert = useCallback((title: string, message?: string, buttons?: AppAlertButton[]) => {
    setState({
      visible: true,
      title,
      message,
      buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }],
    });
  }, []);

  const dismiss = () => setState((s) => ({ ...s, visible: false }));

  const handlePress = (button: AppAlertButton) => {
    dismiss();
    button.onPress?.();
  };

  return (
    <AlertContext.Provider value={{ alert }}>
      {children}
      <Modal visible={state.visible} transparent animationType="fade" onRequestClose={dismiss}>
        <Animated.View entering={FadeIn.duration(150)} style={styles.overlay}>
          <Animated.View entering={ZoomIn.duration(200).springify().damping(16)} style={styles.card}>
            <Text style={styles.title}>{state.title}</Text>
            {!!state.message && <Text style={styles.message}>{state.message}</Text>}
            <View style={styles.buttonsColumn}>
              {state.buttons.map((button, index) => (
                <Pressable
                  key={`${button.text}-${index}`}
                  style={({ pressed }) => [
                    styles.button,
                    button.style === 'cancel' && styles.buttonCancel,
                    button.style === 'destructive' && styles.buttonDestructive,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() => handlePress(button)}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      button.style === 'cancel' && styles.buttonTextCancel,
                      button.style === 'destructive' && styles.buttonTextDestructive,
                    ]}
                  >
                    {button.text}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
    </AlertContext.Provider>
  );
}

export const useAppAlert = () => useContext(AlertContext);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    width: '100%',
    maxWidth: 420,
    ...SHADOWS.floating,
  },
  title: {
    fontSize: FONTS.sizeLarge,
    fontFamily: FONTS.family.bold,
    color: COLORS.text,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  message: {
    fontSize: FONTS.sizeMedium,
    fontFamily: FONTS.family.regular,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  buttonsColumn: {
    gap: SPACING.sm,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    minHeight: TOUCH_TARGET.minHeight,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonCancel: {
    backgroundColor: COLORS.inputBg,
  },
  buttonDestructive: {
    backgroundColor: COLORS.dangerLight,
  },
  buttonText: {
    fontSize: FONTS.sizeMedium,
    fontFamily: FONTS.family.bold,
    color: COLORS.white,
  },
  buttonTextCancel: {
    color: COLORS.textSecondary,
  },
  buttonTextDestructive: {
    color: COLORS.danger,
  },
});
