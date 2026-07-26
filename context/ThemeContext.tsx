import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { ColorScheme, darkScheme, lightScheme } from '@/lib/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Modo claro / oscuro
//
// El esquema oscuro no es una inversión del claro: se diseñó para la escena real
// de esta app —una alarma a las 3 AM en la cara de una persona de 80 años— y por
// eso vive como esquema de primera clase en lib/theme.ts.
//
// Por defecto sigue el ajuste del sistema Android ('auto'), pero se puede fijar
// desde Perfil: hay personas mayores a las que el modo oscuro les cuesta leer y
// no saben dónde cambiarlo en los ajustes del teléfono.
// ─────────────────────────────────────────────────────────────────────────────

export type ThemePreference = 'auto' | 'light' | 'dark';

const STORAGE_KEY = 'theme_preference';

interface ThemeContextValue {
  /** El esquema de color activo. Todo componente lee sus colores de aquí. */
  scheme: ColorScheme;
  /** true si el esquema activo es el oscuro. */
  isDark: boolean;
  /** Lo que el usuario eligió, que puede ser 'auto'. */
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  scheme: lightScheme,
  isDark: false,
  preference: 'auto',
  setPreference: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('auto');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (value === 'light' || value === 'dark' || value === 'auto') {
          setPreferenceState(value);
        }
      })
      .catch(() => {});
  }, []);

  const setPreference = (p: ThemePreference) => {
    setPreferenceState(p);
    AsyncStorage.setItem(STORAGE_KEY, p).catch(() => {});
  };

  const value = useMemo<ThemeContextValue>(() => {
    const isDark = preference === 'auto' ? systemScheme === 'dark' : preference === 'dark';
    return {
      scheme: isDark ? darkScheme : lightScheme,
      isDark,
      preference,
      setPreference,
    };
  }, [preference, systemScheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Devuelve el esquema de color activo. Ver La Regla del Rol, no del Hex. */
export const useTheme = () => useContext(ThemeContext);

/**
 * Memoiza una hoja de estilos derivada del esquema activo.
 *
 *   const styles = useThemedStyles(makeStyles);
 *   const makeStyles = (t: ColorScheme) => StyleSheet.create({ ... });
 *
 * Se recalcula solo cuando cambia el esquema, no en cada render.
 */
export function useThemedStyles<T>(factory: (scheme: ColorScheme) => T): T {
  const { scheme } = useTheme();
  return useMemo(() => factory(scheme), [scheme, factory]);
}
