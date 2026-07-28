import { supabase } from '@/lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// Fotos de medicamentos.
//
// El bucket es PRIVADO (ver la migración "Fotos privadas" en
// supabase-schema.sql): la foto de una caja de pastillas es un dato de salud y
// antes cualquiera con la URL podía verla sin siquiera tener cuenta.
//
// Con el bucket cerrado, una URL fija ya no sirve. Lo que se guarda en
// medications.photo_url es la RUTA dentro del bucket —'<user_id>/<ts>.jpg'— y
// la app pide una URL firmada de una hora cada vez que necesita mostrarla.
//
// La primera carpeta de la ruta es el user_id del paciente dueño: de ahí saca
// la política RLS a quién dejar pasar, así que subir con otro prefijo hace que
// la propia foto quede inaccesible.
// ─────────────────────────────────────────────────────────────────────────────

export const PHOTO_BUCKET = 'medication-photos';

const SIGNED_TTL_SECONDS = 60 * 60;
/** Se re-firma un poco antes de que expire, para que no caduque a media pantalla. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

const LEGACY_PUBLIC_MARKER = `/storage/v1/object/public/${PHOTO_BUCKET}/`;

/** Caché en memoria: la pantalla de Inicio pinta una lista y no vale la pena
 *  pedir una firma por tarjeta en cada render. */
const signedCache = new Map<string, { url: string; expiresAt: number }>();

/** Al cerrar sesión: las firmas emitidas siguen siendo válidas hasta que
 *  expiren, y no tienen por qué sobrevivir en memoria al usuario que las pidió. */
export function clearPhotoCache(): void {
  signedCache.clear();
}

/** Una foto recién tomada o elegida todavía vive en el teléfono. */
export function isLocalUri(value: string): boolean {
  return (
    value.startsWith('file:') ||
    value.startsWith('content:') ||
    value.startsWith('data:') ||
    value.startsWith('blob:') ||
    value.startsWith('ph:') ||
    value.startsWith('assets-library:')
  );
}

/**
 * Ruta dentro del bucket a partir de lo guardado en photo_url. Acepta también
 * las URLs públicas completas de cuando el bucket era abierto: la migración
 * normaliza la columna, pero una fila creada por una versión vieja de la app
 * mientras se despliega esto no tiene por qué romperse.
 */
export function toStoragePath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.includes(LEGACY_PUBLIC_MARKER)) {
    return value.split(LEGACY_PUBLIC_MARKER)[1]?.split('?')[0] || null;
  }
  if (value.startsWith('http')) return null; // URL remota ajena al bucket
  return value;
}

/**
 * URI lista para <Image>. Devuelve la misma URI si es local, y una URL firmada
 * si es una ruta del bucket. null si no hay foto o si la firma falla (sin
 * conexión, o un cuidador al que ya le quitaron el acceso).
 */
export async function resolvePhotoUri(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  if (isLocalUri(value)) return value;

  const path = toStoragePath(value);
  if (!path) return value.startsWith('http') ? value : null;

  const cached = signedCache.get(path);
  if (cached && cached.expiresAt - REFRESH_MARGIN_MS > Date.now()) {
    return cached.url;
  }

  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrl(path, SIGNED_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    console.log('No se pudo firmar la foto:', error?.message);
    return null;
  }

  signedCache.set(path, {
    url: data.signedUrl,
    expiresAt: Date.now() + SIGNED_TTL_SECONDS * 1000,
  });
  return data.signedUrl;
}

/**
 * Sube la foto a la carpeta del paciente y devuelve la RUTA a guardar en
 * medications.photo_url (no una URL: ver la nota de arriba). null si falló.
 */
export async function uploadMedicationPhoto(uri: string, patientId: string): Promise<string | null> {
  try {
    const path = `${patientId}/${Date.now()}.jpg`;
    const response = await fetch(uri);
    const blob = await response.blob();
    const arrayBuffer = await new Response(blob).arrayBuffer();

    const { error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: false });

    if (error) {
      console.error('Error subiendo la foto:', error.message);
      return null;
    }
    return path;
  } catch (err) {
    console.error('Error subiendo la foto:', err);
    return null;
  }
}

/** Borra el archivo del bucket. Silencioso: que falle no debe impedir guardar. */
export async function deleteMedicationPhoto(value: string | null | undefined): Promise<void> {
  const path = toStoragePath(value);
  if (!path) return;
  signedCache.delete(path);
  await supabase.storage.from(PHOTO_BUCKET).remove([path]);
}
