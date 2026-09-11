import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Text from '@/components/ui/Text';
import { useTheme } from '@/context/ThemeContext';
import { SHAPE, SPACING, STATE_LAYER, withAlpha } from '@/lib/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Descargo de responsabilidad médica — el escudo legal, dicho DENTRO de la app.
//
// El texto completo vive en docs/terminos.html (secciones 3 y 6), pero un
// descargo que solo existe detrás de un enlace no protege igual que uno que la
// persona ve. Este bloque lo pone a la vista en los dos momentos que importan:
//
//   · Al registrarse (pantalla de entrada), antes de aceptar y crear la cuenta.
//   · En Perfil → Acerca de, donde queda consultable para siempre.
//
// Reúne los dos pilares del escudo en lenguaje llano para 80+:
//   1. Descargo médico: es una ayuda para recordar, NO un dispositivo médico, y
//      no sustituye al doctor. El usuario es el responsable.
//   2. Cláusula "tal cual" (as-is): la alarma depende del teléfono y puede no
//      sonar; no debe ser el único medio para una dosis crítica.
//
// Rol de color: `surfaceContainer` con acento `primaryContainer` en el ícono —
// NO `warningContainer`. Esto es información esperable y permanente, no una
// alerta puntual; usar el ámbar aquí lo gastaba como decoración y le restaba
// peso a la única vez que de verdad importa: el semáforo de una dosis (ver "La
// Regla del Semáforo Honesto" en DESIGN.md). Un escudo legal que se lee como
// advertencia agresiva genera desconfianza, no protección.
// ─────────────────────────────────────────────────────────────────────────────

interface MedicalDisclaimerProps {
  /** Versión de una sola línea, para espacios apretados. */
  compact?: boolean;
  /** Si se pasa, muestra un enlace "Leer los términos completos". */
  onReadTerms?: () => void;
  style?: StyleProp<ViewStyle>;
}

export default function MedicalDisclaimer({ compact = false, onReadTerms, style }: MedicalDisclaimerProps) {
  const { scheme } = useTheme();

  return (
    <View
      accessibilityRole="summary"
      style={[styles.card, { backgroundColor: scheme.surfaceContainer }, style]}
    >
      <View style={styles.header}>
        <View style={[styles.iconBadge, { backgroundColor: scheme.primaryContainer }]}>
          <Ionicons name="shield-checkmark" size={20} color={scheme.onPrimaryContainer} />
        </View>
        <Text variant="titleSmall" style={styles.title}>
          Aviso importante
        </Text>
      </View>

      <Text variant="bodySmall" tone="variant" style={styles.body}>
        TeRecuerda es <Text variant="labelMedium">solo una ayuda para recordar</Text> tus
        medicinas. No es un aparato médico ni sustituye a tu doctor. Tú eres el responsable de tomar tus
        medicamentos y de consultar cualquier duda con un profesional de la salud.
      </Text>

      {!compact && (
        <Text variant="bodySmall" tone="variant" style={styles.body}>
          Las alarmas dependen de tu teléfono: si se apaga, se queda sin batería o el sistema cierra la
          app, es posible que <Text variant="labelMedium">no suene</Text>. La app
          se ofrece &quot;tal cual&quot;, sin garantía de que funcione siempre. No la uses como único medio
          para una medicina que no puede fallar.
        </Text>
      )}

      {onReadTerms && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Leer los términos de uso completos"
          onPress={onReadTerms}
          style={({ pressed }) => [
            styles.link,
            pressed && { backgroundColor: withAlpha(scheme.primary, STATE_LAYER.pressed) },
          ]}
        >
          <Text variant="labelMedium" tone="primary" style={styles.linkText}>
            Leer los términos completos
          </Text>
          <Ionicons name="open-outline" size={18} color={scheme.primary} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: SHAPE.large,
    padding: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: SHAPE.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
  },
  body: {
    marginTop: SPACING.xs,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: SPACING.xs,
    marginTop: SPACING.md,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: SHAPE.small,
  },
  linkText: {
    textDecorationLine: 'underline',
  },
});
