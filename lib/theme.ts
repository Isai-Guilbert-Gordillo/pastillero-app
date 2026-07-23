// ─── Tema Premium Médico · WCAG 2.1 · Gerontología Digital ───
// Optimizado para usuarios 80+: alto contraste, touch targets 70px, tipografía gruesa
// Paleta moderna: teal/esmeralda + índigo + coral, neutrales "slate"

export const COLORS = {
  primary: '#0D9488',         // Teal/Esmeralda — confianza médica, más vivo que el verde clásico
  primaryDark: '#0F766E',     // Para gradientes / estado presionado
  primaryLight: '#5EEAD4',    // Teal claro — acentos
  primaryBg: '#ECFDF9',       // Teal muy claro — fondos suaves
  secondary: '#4F46E5',       // Índigo — enlaces, información
  secondaryLight: '#EEF2FF',
  accent: '#FB7185',          // Coral/Rosa — iconos de medicamentos, calidez
  accentDark: '#F43F5E',
  accentGold: '#C5A572',      // Dorado mate — alternativa de acento
  white: '#FFFFFF',
  background: '#F8FAFC',      // Slate-50 — limpieza clínica, ligeramente frío
  card: '#FFFFFF',
  text: '#1E293B',            // Slate-800 — máximo contraste sin ser negro puro
  textSecondary: '#64748B',   // Slate-500
  textLight: '#94A3B8',       // Slate-400 — placeholders
  border: '#E2E8F0',          // Slate-200
  danger: '#DC2626',
  dangerLight: '#FEF2F2',
  success: '#059669',
  successLight: '#ECFDF5',
  warning: '#F59E0B',         // Ámbar — próximas tomas / alertas
  warningLight: '#FFFBEB',
  warningBg: '#FFF8E1',
  inputBg: '#F1F5F9',         // Slate-100 — campos de entrada
  cardShadow: '#0F172A',      // Slate-900 — sombras con un toque de color en vez de negro puro
};

export const GRADIENTS = {
  primary: ['#14B8A6', '#0D9488', '#0F766E'] as const,
  accent: ['#FB7185', '#F43F5E'] as const,
  alarm: ['#F59E0B', '#DC2626'] as const,
};

export const FONTS = {
  sizeSmall: 18,              // Mínimo legible para 80+
  sizeMedium: 20,             // Cuerpo base
  sizeLarge: 24,              // Subtítulos
  sizeXLarge: 28,             // Encabezados de sección
  sizeTitle: 32,              // Títulos principales (Bold)
  sizeHero: 36,               // Tarjeta de alerta gigante
  // Familia tipográfica Poppins (cargada en app/_layout.tsx vía @expo-google-fonts/poppins)
  family: {
    regular: 'Poppins_400Regular',
    medium: 'Poppins_500Medium',
    semiBold: 'Poppins_600SemiBold',
    bold: 'Poppins_700Bold',
    extraBold: 'Poppins_800ExtraBold',
  },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BORDER_RADIUS = {
  sm: 10,
  md: 16,                    // Bordes redondeados para inputs/chips
  lg: 22,
  xl: 30,
  full: 999,
};

// Área mínima de toque: 70×70 px (WCAG / precisión motora reducida)
export const TOUCH_TARGET = {
  minHeight: 70,
  minWidth: 70,
};

// ─── Sombras centralizadas (antes duplicadas por archivo) ───
export const SHADOWS = {
  card: {
    shadowColor: COLORS.cardShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  button: {
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  floating: {
    shadowColor: COLORS.cardShadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
};
