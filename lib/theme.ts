// ─────────────────────────────────────────────────────────────────────────────
// Sistema de diseño de PastilleroApp — Material 3 templado para 80+
// Ver DESIGN.md en la raíz del proyecto para la doctrina completa.
//
// THESIS: los roles, componentes y gestos de Material 3 sin diluir, porque son
// los que la persona ya aprendió en el resto de su teléfono Android. Encima de
// esa gramática la marca aporta una sola cosa: el teal. El resto es rigor.
//
// Reglas que este archivo hace cumplir:
//   · La Regla del Rol, no del Hex — ningún componente escribe un hexadecimal.
//     Todo pasa por un rol del esquema activo (useTheme()), porque un hex no
//     sabe resolverse en modo oscuro.
//   · La Regla de los 16 — ningún texto baja de 16sp.
//   · Objetivo táctil de 64dp (Material pide 48; PRODUCT.md manda más).
// ─────────────────────────────────────────────────────────────────────────────

import { Platform, TextStyle, ViewStyle } from 'react-native';

// ═══════════════════════════════════════════════════════════════════════════
// 1. Rampas tonales
// ═══════════════════════════════════════════════════════════════════════════
// "Pino Clínico" — retonado en sep. 2026 (ver DESIGN.md, sección Colores).
// El teal original (#0D9488, familia Tailwind) tenía demasiada croma en sus
// tonos altos: T80 #5EEAD4 es un cian casi neón, y en modo oscuro —fondo casi
// negro + ese cian como `primary`— leía como pantalla de terminal futurista,
// no como una app de salud para 80+. Esta rampa baja la croma en cada paso
// manteniendo las MISMAS relaciones de luminancia (ningún contraste ya
// verificado se pierde), para leer "consultorio/farmacia de confianza" en vez
// de "neón sobre negro". El rol `primary` del esquema claro sigue siendo dos
// pasos más oscuro que el tono de marca (T40, no T50) por la misma razón de
// contraste de siempre: blanco sobre T50 no pasa a cualquier tamaño, sobre
// T40 sí.

const teal = {
  t0: '#000000',
  t10: '#0B211D',
  t20: '#14372F',
  t30: '#1E5045',
  t40: '#286B5C',
  t50: '#347F6E', // ← tono de marca declarado
  t60: '#4A9684',
  t70: '#64AC9A',
  t80: '#86C4B3',
  t90: '#BBE0D3',
  t95: '#DCEFE8',
  t98: '#EFF6F3',
  t100: '#FFFFFF',
} as const;

const indigo = {
  t10: '#16135C',
  t20: '#262185',
  t30: '#3730A3',
  t40: '#4338CA',
  t50: '#4F46E5',
  t80: '#C7D2FE',
  t90: '#E0E7FF',
  t95: '#EEF2FF',
} as const;

const rose = {
  t10: '#4C0519',
  t20: '#881337',
  t30: '#9F1239',
  t40: '#BE123C',
  t50: '#E11D48',
  t70: '#FDA4AF',
  t80: '#FECDD3',
  t90: '#FFE4E8',
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// 2. Esquemas de color (roles Material 3 + 3 roles semánticos propios)
// ═══════════════════════════════════════════════════════════════════════════
// Material 3 no define un rol "warning" ni "success"; esta app los necesita
// porque el estado de una dosis es literalmente un semáforo. Se agregan como
// roles de primera clase con su par contenedor/on-contenedor, para que se
// comporten igual que los roles nativos y resuelvan bien en oscuro.

export interface ColorScheme {
  readonly dark: boolean;

  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  /** Tono de identidad de marca. Solo para campos grandes sin texto encima. */
  brand: string;

  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;

  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;

  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;

  warning: string;
  onWarning: string;
  warningContainer: string;
  onWarningContainer: string;

  success: string;
  onSuccess: string;
  successContainer: string;
  onSuccessContainer: string;

  /** Suelo de la app. Las superficies flotan sobre esto sin necesidad de sombra. */
  background: string;
  onBackground: string;
  /** Tarjetas, hojas, diálogos — el "compartimento" del pastillero. */
  surface: string;
  onSurface: string;
  /** Bloque interior dentro de una tarjeta. Ver La Regla de la Tarjeta que No Anida. */
  surfaceContainer: string;
  /** Campos de entrada, separadores con peso, fondos de celda. */
  surfaceVariant: string;
  onSurfaceVariant: string;
  /** Solo placeholders y texto deshabilitado. Mínimo 4.5:1. */
  onSurfaceMuted: string;

  /** Bordes de componentes interactivos. Mínimo 3:1 contra su fondo. */
  outline: string;
  /** Separadores decorativos. Sin requisito de contraste. */
  outlineVariant: string;

  /** Scrim de bottom sheets y diálogos. */
  scrim: string;
  /** Fondo del snackbar (inverso de la superficie). */
  inverseSurface: string;
  onInverseSurface: string;
  inversePrimary: string;

  /** Sombra base. Con tinte de color, nunca negro puro. */
  shadow: string;
}

export const lightScheme: ColorScheme = {
  dark: false,

  primary: teal.t40,
  onPrimary: '#FFFFFF',
  primaryContainer: teal.t90,
  onPrimaryContainer: teal.t10,
  brand: teal.t50,

  secondary: indigo.t40,
  onSecondary: '#FFFFFF',
  secondaryContainer: indigo.t90,
  onSecondaryContainer: indigo.t10,

  tertiary: rose.t40,
  onTertiary: '#FFFFFF',
  tertiaryContainer: rose.t90,
  onTertiaryContainer: rose.t10,

  error: '#B91C1C',
  onError: '#FFFFFF',
  errorContainer: '#FEE2E2',
  onErrorContainer: '#450A0A',

  warning: '#92400E',
  onWarning: '#FFFFFF',
  warningContainer: '#FEF3C7',
  onWarningContainer: '#451A03',

  success: '#047857',
  onSuccess: '#FFFFFF',
  successContainer: '#D1FAE5',
  onSuccessContainer: '#022C22',

  background: '#F5F4EF',
  onBackground: '#0F172A',
  surface: '#FFFFFF',
  onSurface: '#0F172A',
  surfaceContainer: '#F7F6F1',
  surfaceVariant: '#E4E2DA',
  onSurfaceVariant: '#475569',
  onSurfaceMuted: '#64748B',

  outline: '#7C8BA1',
  outlineVariant: '#CBD5E1',

  scrim: 'rgba(11, 33, 29, 0.4)',
  inverseSurface: '#1E2B27',
  onInverseSurface: '#EFF3F0',
  inversePrimary: teal.t80,

  shadow: '#11201D',
};

// El esquema oscuro no es una inversión. Se diseñó para la escena real: una
// alarma a las 3 AM en la cara de una persona de 80 años. Los fondos son
// tealados y muy oscuros (no negro puro, que produce halo en OLED), los tonos
// primarios suben a T80 y el contraste de texto se mantiene por encima de 9:1.
// T80 aquí es la versión desaturada de la rampa (ver sección 1): sigue siendo
// legible de lejos sin leer como un cian que brilla — un teal atenuado, no un
// tubo de neón.
export const darkScheme: ColorScheme = {
  dark: true,

  primary: teal.t80,
  onPrimary: teal.t10,
  primaryContainer: teal.t30,
  onPrimaryContainer: teal.t90,
  brand: teal.t60,

  secondary: indigo.t80,
  onSecondary: indigo.t10,
  secondaryContainer: '#312B8F',
  onSecondaryContainer: indigo.t90,

  tertiary: rose.t70,
  onTertiary: rose.t10,
  tertiaryContainer: rose.t30,
  onTertiaryContainer: rose.t90,

  error: '#FCA5A5',
  onError: '#450A0A',
  errorContainer: '#7F1D1D',
  onErrorContainer: '#FEE2E2',

  warning: '#FCD34D',
  onWarning: '#451A03',
  warningContainer: '#78350F',
  onWarningContainer: '#FEF3C7',

  success: '#6EE7B7',
  onSuccess: '#022C22',
  successContainer: '#065F46',
  onSuccessContainer: '#D1FAE5',

  background: '#111C18',
  onBackground: '#E7EEE9',
  surface: '#182420',
  onSurface: '#E7EEE9',
  surfaceContainer: '#1E2B26',
  surfaceVariant: '#28362F',
  onSurfaceVariant: '#B4C2BB',
  onSurfaceMuted: '#8A9C93',

  outline: '#7C9089',
  outlineVariant: '#324039',

  scrim: 'rgba(0, 0, 0, 0.6)',
  inverseSurface: '#E7EEE9',
  onInverseSurface: '#182420',
  inversePrimary: teal.t40,

  shadow: '#000000',
};

// ═══════════════════════════════════════════════════════════════════════════
// 3. Escala tipográfica
// ═══════════════════════════════════════════════════════════════════════════
// Roles de Material 3 mapeados a Poppins y recalibrados hacia arriba: el cuerpo
// de Material es 16sp; aquí es 19sp y el piso absoluto es 16sp.
//
// Sobre "sp": en React Native, `fontSize` ya sigue el ajuste de tamaño de
// fuente del sistema por defecto (allowFontScaling), que es exactamente la
// semántica de sp en Android. Lo que faltaba —y este sistema agrega— es el
// techo: `maxFontSizeMultiplier` por rol, para que al 200% del sistema una
// alarma no se vuelva ilegible por desbordamiento. El espaciado y los objetivos
// táctiles NO escalan: son dp.

export const FONT_FAMILY = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semiBold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
  extraBold: 'Poppins_800ExtraBold',
} as const;

export type TypeRole =
  | 'displayLarge' | 'displayMedium' | 'displaySmall'
  | 'headlineLarge' | 'headlineMedium' | 'headlineSmall'
  | 'titleLarge' | 'titleMedium' | 'titleSmall'
  | 'bodyLarge' | 'bodyMedium' | 'bodySmall'
  | 'labelLarge' | 'labelMedium' | 'labelSmall';

export interface TypeSpec {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  /** Techo del escalado del sistema. Ver La Regla del sp Con Techo. */
  maxScale: number;
}

export const TYPE: Record<TypeRole, TypeSpec> = {
  displayLarge:   { fontFamily: FONT_FAMILY.extraBold, fontSize: 44, lineHeight: 52, letterSpacing: -0.5, maxScale: 1.5 },
  displayMedium:  { fontFamily: FONT_FAMILY.extraBold, fontSize: 36, lineHeight: 44, letterSpacing: -0.4, maxScale: 1.5 },
  displaySmall:   { fontFamily: FONT_FAMILY.bold,      fontSize: 30, lineHeight: 38, letterSpacing: -0.2, maxScale: 1.5 },

  headlineLarge:  { fontFamily: FONT_FAMILY.bold,      fontSize: 30, lineHeight: 38, letterSpacing: 0,    maxScale: 1.5 },
  headlineMedium: { fontFamily: FONT_FAMILY.bold,      fontSize: 26, lineHeight: 34, letterSpacing: 0,    maxScale: 1.5 },
  headlineSmall:  { fontFamily: FONT_FAMILY.bold,      fontSize: 24, lineHeight: 32, letterSpacing: 0,    maxScale: 1.5 },

  titleLarge:     { fontFamily: FONT_FAMILY.semiBold,  fontSize: 22, lineHeight: 30, letterSpacing: 0,    maxScale: 1.6 },
  titleMedium:    { fontFamily: FONT_FAMILY.semiBold,  fontSize: 20, lineHeight: 28, letterSpacing: 0.15, maxScale: 1.6 },
  titleSmall:     { fontFamily: FONT_FAMILY.semiBold,  fontSize: 18, lineHeight: 26, letterSpacing: 0.1,  maxScale: 1.6 },

  bodyLarge:      { fontFamily: FONT_FAMILY.regular,   fontSize: 19, lineHeight: 30, letterSpacing: 0.15, maxScale: 1.8 },
  bodyMedium:     { fontFamily: FONT_FAMILY.regular,   fontSize: 18, lineHeight: 28, letterSpacing: 0.25, maxScale: 1.8 },
  bodySmall:      { fontFamily: FONT_FAMILY.regular,   fontSize: 16, lineHeight: 24, letterSpacing: 0.4,  maxScale: 1.8 },

  labelLarge:     { fontFamily: FONT_FAMILY.bold,      fontSize: 18, lineHeight: 24, letterSpacing: 0.1,  maxScale: 1.6 },
  labelMedium:    { fontFamily: FONT_FAMILY.semiBold,  fontSize: 16, lineHeight: 20, letterSpacing: 0.5,  maxScale: 1.6 },
  labelSmall:     { fontFamily: FONT_FAMILY.semiBold,  fontSize: 14, lineHeight: 18, letterSpacing: 0.5,  maxScale: 1.6 },
};

/** Convierte un rol tipográfico en estilo de RN (sin color; el color es un rol aparte). */
export const type = (role: TypeRole): TextStyle => {
  const t = TYPE[role];
  return {
    fontFamily: t.fontFamily,
    fontSize: t.fontSize,
    lineHeight: t.lineHeight,
    letterSpacing: t.letterSpacing,
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// 4. Espaciado — cuadrícula base de 4dp
// ═══════════════════════════════════════════════════════════════════════════
// Ritmo: 8 entre elementos del mismo grupo, 16 dentro de una tarjeta, 24 entre
// grupos, 32 antes de un encabezado de sección. Siempre más aire arriba de un
// encabezado que abajo.

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/** Margen de pantalla en ancho compacto (window size class "compact" de Material). */
export const SCREEN_MARGIN = 16;

// ═══════════════════════════════════════════════════════════════════════════
// 5. Forma — escala de Material 3
// ═══════════════════════════════════════════════════════════════════════════

export const SHAPE = {
  none: 0,
  extraSmall: 4,
  small: 8,
  medium: 12,
  large: 16,
  extraLarge: 28,
  full: 999,
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// 6. Objetivo táctil
// ═══════════════════════════════════════════════════════════════════════════
// Material pide 48×48dp. PRODUCT.md pide más para precisión motora reducida, y
// aquí queda formalizado como token en lugar de un número suelto por archivo.

export const TOUCH = {
  /** Mínimo de cualquier control. */
  min: 64,
  /** Acción principal de una pantalla. */
  primary: 72,
  /** Separación mínima entre dos objetivos adyacentes. */
  gap: 8,
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// 7. Elevación
// ═══════════════════════════════════════════════════════════════════════════
// Híbrida con el tono primero: la separación entre capas la hace el color de
// superficie; la sombra solo la confirma, y solo en lo que de verdad flota.
// En oscuro las sombras son invisibles, así que se apagan y queda tonal pura.
// La Regla del Halo Prohibido: ninguna sombra con offset 0 y color de marca.

export type ElevationLevel = 0 | 1 | 2 | 3 | 4;

export const elevation = (level: ElevationLevel, scheme: ColorScheme): ViewStyle => {
  if (level === 0) return {};
  if (scheme.dark) {
    // Elevación tonal pura. Android sigue necesitando `elevation` para que las
    // superficies se ordenen correctamente en el eje Z, pero sin sombra visible.
    return { elevation: level * 2 };
  }
  const specs: Record<Exclude<ElevationLevel, 0>, ViewStyle> = {
    1: { shadowOffset: { width: 0, height: 1 }, shadowRadius: 3,  shadowOpacity: 0.10, elevation: 1 },
    2: { shadowOffset: { width: 0, height: 2 }, shadowRadius: 6,  shadowOpacity: 0.12, elevation: 3 },
    3: { shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, shadowOpacity: 0.14, elevation: 6 },
    4: { shadowOffset: { width: 0, height: 8 }, shadowRadius: 24, shadowOpacity: 0.18, elevation: 8 },
  };
  return { shadowColor: scheme.shadow, ...specs[level] };
};

// ═══════════════════════════════════════════════════════════════════════════
// 8. Movimiento
// ═══════════════════════════════════════════════════════════════════════════
// Curvas y duraciones de Material 3. `emphasized` para lo que entra o cambia de
// contenedor, `standard` para cambios de estado dentro de un componente.

export const MOTION = {
  duration: {
    short: 150,
    medium: 250,
    long: 400,
    extraLong: 550,
  },
  /** Bezier de Material 3, en el formato que espera Reanimated (Easing.bezier). */
  easing: {
    emphasized: [0.2, 0, 0, 1] as const,
    emphasizedDecelerate: [0.05, 0.7, 0.1, 1] as const,
    emphasizedAccelerate: [0.3, 0, 0.8, 0.15] as const,
    standard: [0.2, 0, 0, 1] as const,
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// 9. Capas de estado (state layers)
// ═══════════════════════════════════════════════════════════════════════════
// Material comunica presionado/enfocado superponiendo el color de contenido a
// una opacidad fija sobre el fondo, en vez de cambiar el color base.

export const STATE_LAYER = {
  pressed: 0.12,
  focus: 0.12,
  hover: 0.08,
  disabled: 0.38,
  disabledContainer: 0.12,
} as const;

/** Aplica alfa a un color hex de 6 dígitos o devuelve rgba() intacto. */
export const withAlpha = (color: string, alpha: number): string => {
  if (!color.startsWith('#') || color.length !== 7) return color;
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${color}${a}`;
};

// ═══════════════════════════════════════════════════════════════════════════
// 10. Utilidades
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// 10.b Paleta de Don Memo (la mascota)
// ═══════════════════════════════════════════════════════════════════════════
// Un personaje no puede resolverse con los roles de superficie: `primaryContainer`
// se invierte entre claro y oscuro, y un abuelo con la cara oscura en modo
// noche no es el mismo personaje, es otro. Así que Don Memo tiene su propia
// paleta —declarada AQUÍ, junto al resto del sistema, nunca suelta dentro del
// componente (La Regla del Rol, no del Hex)— con dos resoluciones que lo dejan
// reconocible en ambos esquemas.
//
// La diferencia en oscuro no es una inversión: la cara baja un punto de brillo
// para no deslumbrar a las 3 AM, y el suéter sube uno para despegarse del
// fondo. El personaje es el mismo.

export interface MascotPalette {
  /** La cabeza: el compartimento del pastillero. */
  head: string;
  /** Costura de la tapa, en la frente. */
  seam: string;
  /** Los ojos. */
  ink: string;
  /** Armazón de los lentes y bigote. */
  frame: string;
  /** El suéter. */
  body: string;
  /** La camisa que asoma en el escote. */
  shirt: string;
  /** Solapas del suéter. */
  lapel: string;
  neck: string;
  button: string;
}

const mascotLight: MascotPalette = {
  head: teal.t95,
  seam: teal.t80,
  ink: teal.t10,
  frame: teal.t40,
  body: teal.t50,
  shirt: teal.t90,
  lapel: teal.t60,
  neck: teal.t80,
  button: teal.t90,
};

const mascotDark: MascotPalette = {
  head: '#C2DCD3',
  seam: '#6FAF9D',
  ink: teal.t10,
  frame: teal.t40,
  body: '#3D8B79',
  shirt: '#A9D2C4',
  lapel: '#54A08D',
  neck: '#6FAF9D',
  button: '#A9D2C4',
};

/** Resuelve la paleta del personaje contra el esquema activo. */
export const mascot = (scheme: ColorScheme): MascotPalette =>
  scheme.dark ? mascotDark : mascotLight;

/** Altura de la barra superior según su variante (Material 3). */
export const APP_BAR_HEIGHT = {
  small: 64,
  large: 112,
} as const;

/** Alto del contenido de la barra de navegación inferior, sin el inset. */
export const NAV_BAR_HEIGHT = 64;

export const IS_ANDROID = Platform.OS === 'android';
export const IS_WEB = Platform.OS === 'web';
