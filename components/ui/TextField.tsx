import React, { useState } from 'react';
import {
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import Text from '@/components/ui/Text';
import { useTheme } from '@/context/ThemeContext';
import { SHAPE, SPACING, TOUCH, TYPE } from '@/lib/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Campo de texto outlined de Material 3, con una desviación deliberada: la
// etiqueta NO flota.
//
// La etiqueta flotante de Material (que empieza dentro del campo y sube al
// enfocar) es un truco de ahorro de espacio que a este público le cuesta: la
// etiqueta se mueve justo cuando el usuario ya empezó a escribir, y a 80 años
// eso se lee como "se borró lo que puse". Aquí la etiqueta vive arriba del
// campo, quieta, siempre visible.
//
// El error nombra el problema y la salida — nunca un "Campo inválido".
// ─────────────────────────────────────────────────────────────────────────────

interface TextFieldProps extends Omit<TextInputProps, 'style' | 'placeholderTextColor'> {
  label: string;
  /** Texto de ayuda permanente bajo el campo. */
  supportingText?: string;
  /** Mensaje de error. Reemplaza al texto de ayuda y tiñe el borde. */
  error?: string | null;
  /** Unidad fija dentro del campo, alineada a la derecha: "mg", "horas", "días". */
  suffix?: string;
  /** Control al final del campo (p. ej. mostrar/ocultar contraseña). */
  trailing?: React.ReactNode;
  /** Ícono decorativo al inicio del campo. */
  leadingIcon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export default function TextField({
  label,
  supportingText,
  error,
  suffix,
  trailing,
  leadingIcon,
  style,
  ...inputProps
}: TextFieldProps) {
  const { scheme } = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error ? scheme.error : focused ? scheme.primary : scheme.outline;
  const borderWidth = error || focused ? 2 : 1;

  return (
    <View style={style}>
      <Text
        variant="labelMedium"
        color={error ? scheme.error : focused ? scheme.primary : scheme.onSurfaceVariant}
        style={styles.label}
      >
        {label}
      </Text>

      <View
        style={[
          styles.field,
          {
            borderColor,
            borderWidth,
            backgroundColor: scheme.surface,
            // Compensa el borde extra para que el contenido no salte al enfocar.
            paddingHorizontal: SPACING.lg - (borderWidth - 1),
          },
        ]}
      >
        {!!leadingIcon && <View style={styles.leading}>{leadingIcon}</View>}
        <TextInput
          accessibilityLabel={label}
          {...inputProps}
          onFocus={(e) => {
            setFocused(true);
            inputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            inputProps.onBlur?.(e);
          }}
          placeholderTextColor={scheme.onSurfaceMuted}
          maxFontSizeMultiplier={TYPE.bodyLarge.maxScale}
          style={[
            styles.input,
            {
              fontFamily: TYPE.bodyLarge.fontFamily,
              fontSize: TYPE.bodyLarge.fontSize,
              color: scheme.onSurface,
            },
          ]}
        />
        {!!suffix && (
          <Text variant="labelMedium" tone="variant" style={styles.suffix}>
            {suffix}
          </Text>
        )}
        {trailing}
      </View>

      {(error || supportingText) && (
        <Text
          variant="bodySmall"
          color={error ? scheme.error : scheme.onSurfaceVariant}
          style={styles.supporting}
        >
          {error ?? supportingText}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    marginBottom: SPACING.sm,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TOUCH.primary,
    borderRadius: SHAPE.extraSmall,
  },
  input: {
    flex: 1,
    // `minWidth: 0` es lo que permite que el campo se encoja por debajo del
    // ancho intrínseco de su placeholder. Sin esto, en un teléfono angosto (o
    // con el tamaño de fuente del sistema al máximo) un placeholder largo empuja
    // el control del final —el ojo de mostrar contraseña— fuera de la pantalla.
    minWidth: 0,
    flexShrink: 1,
    paddingVertical: SPACING.lg,
  },
  leading: {
    marginRight: SPACING.md,
  },
  suffix: {
    marginLeft: SPACING.md,
  },
  supporting: {
    marginTop: SPACING.xs,
    marginLeft: SPACING.xs,
  },
});
