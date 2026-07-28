import { resolvePhotoUri } from '@/lib/photos';
import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import { ImageStyle, StyleProp } from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
// La foto de un medicamento, venga de donde venga.
//
// Con el bucket privado, mostrar una foto ya no es poner una URL en <Image>:
// hay que pedirle a Supabase una URL firmada, y eso es asíncrono. Este
// componente existe para que ninguna pantalla tenga que saberlo — recibe lo
// mismo que antes (medication.photo_url, o la URI local de una foto recién
// tomada) y se encarga del resto.
//
// Tiene que ser un COMPONENTE y no un hook: en Inicio las tarjetas se pintan
// desde el renderItem de una FlatList, que se invoca como función normal y no
// admite hooks.
//
// Mientras firma —y si la firma falla, por ejemplo sin conexión— muestra
// `fallback`, el mismo marcador que ya usaba cada pantalla cuando no había
// foto. Nunca deja un hueco en blanco.
// ─────────────────────────────────────────────────────────────────────────────

interface MedicationPhotoProps {
  /** Ruta en el bucket, o URI local si la foto todavía no se sube. */
  source: string | null | undefined;
  style: StyleProp<ImageStyle>;
  /** Qué mostrar si no hay foto o no se pudo cargar. */
  fallback?: React.ReactNode;
  accessibilityLabel?: string;
}

export default function MedicationPhoto({
  source,
  style,
  fallback = null,
  accessibilityLabel,
}: MedicationPhotoProps) {
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setUri(null);

    resolvePhotoUri(source).then((resolved) => {
      if (!cancelled) setUri(resolved);
    });

    return () => {
      cancelled = true;
    };
  }, [source]);

  if (!uri) return <>{fallback}</>;

  return (
    <Image
      source={{ uri }}
      style={style}
      contentFit="cover"
      accessibilityLabel={accessibilityLabel}
    />
  );
}
