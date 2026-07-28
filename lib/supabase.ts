import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─────────────────────────────────────────────────────────────────────────────
// Cliente de Supabase.
//
// La URL y la anon key salen del entorno, no del código. La anon key es
// pública por diseño —viaja en cada petición desde el teléfono y la seguridad
// real la dan las políticas RLS— pero tenerla escrita a mano aquí obligaba a
// editar el archivo para cambiar de proyecto, y hacía imposible tener uno de
// pruebas y otro de producción sin arriesgarse a publicar apuntando al
// equivocado.
//
// El prefijo EXPO_PUBLIC_ no es decorativo: Expo solo sustituye en el bundle
// del cliente las variables que lo llevan. Nunca pongas aquí la service_role
// key — esa sí salta todas las políticas RLS y no debe salir del servidor.
//
// Ver .env.example y la sección de instalación del README.
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Falla ruidosa y temprana. La alternativa —un cliente a medio construir—
  // se manifestaría más tarde como "no se pudo guardar, revisa tu conexión",
  // que manda a buscar el problema al lugar equivocado.
  throw new Error(
    'Faltan EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Copia .env.example a .env y llénalo (ver README).'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
