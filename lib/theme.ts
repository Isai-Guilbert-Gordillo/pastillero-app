// ─── Tema Premium Médico · WCAG 2.1 · Gerontología Digital ───
// Optimizado para usuarios 80+: alto contraste, touch targets 70px, tipografía gruesa
// Paleta sofisticada: verde azulado profundo + coral cálido + gris perla

export const COLORS = {
  primary: '#00695C',         // Verde Azulado Profundo — confianza médica
  primaryLight: '#4DB6AC',    // Teal medio
  primaryBg: '#E0F2F1',       // Teal muy claro
  secondary: '#1565C0',       // Azul (enlaces)
  secondaryLight: '#E3F2FD',
  accent: '#FF8A65',          // Coral suave — iconos de medicamentos, calidez
  accentGold: '#C5A572',      // Dorado mate — alternativa de acento
  white: '#FFFFFF',
  background: '#F8F9FA',      // Gris perla — limpieza clínica
  card: '#FFFFFF',
  text: '#263238',            // Gris pizarra oscuro — máximo contraste
  textSecondary: '#546E7A',   // Gris azulado medio
  textLight: '#90A4AE',       // Gris claro para placeholders
  border: '#E0E0E0',
  danger: '#C62828',          // Rojo oscuro
  dangerLight: '#FFEBEE',
  success: '#00695C',
  successLight: '#E0F2F1',
  warning: '#F57C00',         // Naranja Intenso — próximas tomas / alertas
  warningLight: '#FFF3E0',
  warningBg: '#FFF8E1',
  inputBg: '#F1F3F4',         // Gris perla para campos de entrada (capa interior)
  cardShadow: '#000000',      // Para sombras consistentes
};

export const FONTS = {
  sizeSmall: 18,              // Mínimo legible para 80+
  sizeMedium: 20,             // Cuerpo base
  sizeLarge: 24,              // Subtítulos
  sizeXLarge: 28,             // Encabezados de sección
  sizeTitle: 32,              // Títulos principales (Bold)
  sizeHero: 36,               // Tarjeta de alerta gigante
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
  md: 15,                    // Bordes redondeados 15px para inputs
  lg: 20,
  xl: 28,
  full: 999,
};

// Área mínima de toque: 70×70 px (WCAG / precisión motora reducida)
export const TOUCH_TARGET = {
  minHeight: 70,
  minWidth: 70,
};
