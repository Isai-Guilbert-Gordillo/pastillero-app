import BrandMark from '@/components/BrandMark';
import { useFeedback } from '@/components/Feedback';
import MedicationPhoto from '@/components/MedicationPhoto';
import PatientBanner from '@/components/PatientBanner';
import Button from '@/components/ui/Button';
import Chip from '@/components/ui/Chip';
import IconBadge from '@/components/ui/IconBadge';
import ListItem, { ListDivider } from '@/components/ui/ListItem';
import Surface from '@/components/ui/Surface';
import Text from '@/components/ui/Text';
import TextField from '@/components/ui/TextField';
import TopAppBar from '@/components/ui/TopAppBar';
import { useCaregiver } from '@/context/CaregiverContext';
import { useTheme, useThemedStyles } from '@/context/ThemeContext';
import { cancelAllMedicationNotifications, scheduleMedicationNotifications, scheduleNativeAlarms } from '@/lib/notifications';
import { deleteMedicationPhoto, uploadMedicationPhoto } from '@/lib/photos';
import { supabase } from '@/lib/supabase';
import { ColorScheme, SCREEN_MARGIN, SHAPE, SPACING, TOUCH, elevation, withAlpha } from '@/lib/theme';
import { Medication } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─────────────────────────────────────────────────────────────────────────────
// Detalle de un medicamento — dos modos en una ruta.
//
// Lectura: los cinco datos del tratamiento como filas de lista dentro de UN
// contenedor, no cinco tarjetas. Son hechos del mismo objeto; separarlos en
// tarjetas los convertía en cinco cosas que decidir.
//
// Edición: exactamente el mismo formulario que el alta (tres grupos, barra de
// acción fija abajo), porque editar y crear son la misma tarea y no tiene
// sentido que se vean distintas.
// ─────────────────────────────────────────────────────────────────────────────

const FREQUENCY_OPTIONS = [
  { label: '4 h', value: '4' },
  { label: '6 h', value: '6' },
  { label: '8 h', value: '8' },
  { label: '12 h', value: '12' },
  { label: '24 h', value: '24' },
];

const TIME_OPTIONS = [
  { icon: 'partly-sunny-outline', label: '6:00 AM', sub: 'Al despertar', value: '06:00' },
  { icon: 'sunny-outline', label: '8:00 AM', sub: 'Desayuno', value: '08:00' },
  { icon: 'restaurant-outline', label: '1:00 PM', sub: 'Comida', value: '13:00' },
  { icon: 'moon-outline', label: '8:00 PM', sub: 'Cena', value: '20:00' },
  { icon: 'bed-outline', label: '10:00 PM', sub: 'Al dormir', value: '22:00' },
] as const;

const DAYS_OF_WEEK = [
  { label: 'L', full: 'Lunes', value: 'mon' },
  { label: 'M', full: 'Martes', value: 'tue' },
  { label: 'Mi', full: 'Miércoles', value: 'wed' },
  { label: 'J', full: 'Jueves', value: 'thu' },
  { label: 'V', full: 'Viernes', value: 'fri' },
  { label: 'S', full: 'Sábado', value: 'sat' },
  { label: 'D', full: 'Domingo', value: 'sun' },
];
const ALL_DAYS = DAYS_OF_WEEK.map((d) => d.value);

const formatTime12h = (time24: string): string => {
  const [h, m] = time24.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
};

interface EditErrors {
  name?: string;
  dose?: string;
  days?: string;
  duration?: string;
}

export default function MedicationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isViewingOther, activePatientLabel } = useCaregiver();
  const { scheme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { alert, snack, sheet } = useFeedback();

  const [medication, setMedication] = useState<Medication | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // ─── Estado del formulario de edición ───
  const [editName, setEditName] = useState('');
  const [editDoseMg, setEditDoseMg] = useState('');
  const [editFrequency, setEditFrequency] = useState('8');
  const [editStartTime, setEditStartTime] = useState('08:00');
  const [editImageUri, setEditImageUri] = useState<string | null>(null);
  const [editSelectedDays, setEditSelectedDays] = useState<string[]>(ALL_DAYS);
  const [editRegimenType, setEditRegimenType] = useState<'indefinido' | 'por_tiempo'>('indefinido');
  const [editDurationDays, setEditDurationDays] = useState('');
  const [errors, setErrors] = useState<EditErrors>({});

  const clearError = (field: keyof EditErrors) => {
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };

  const resetEditFields = (data: Medication) => {
    setEditName(data.name);
    setEditDoseMg(String(data.dose_mg));
    setEditFrequency(String(data.frequency_hours));
    setEditStartTime(data.start_time);
    setEditImageUri(data.photo_url);
    setEditSelectedDays(data.days_of_week?.length ? data.days_of_week : ALL_DAYS);
    setEditRegimenType(data.regimen_type ?? 'indefinido');
    setEditDurationDays(data.duration_days ? String(data.duration_days) : '');
    setErrors({});
  };

  const fetchMedication = async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from('medications')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      snack('No se encontró ese medicamento.', { tone: 'error' });
      router.back();
      return;
    }
    setMedication(data);
    resetEditFields(data);
    setLoading(false);
  };

  const toggleEditDay = (day: string) => {
    clearError('days');
    setEditSelectedDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const selectAllEditDays = () => {
    clearError('days');
    setEditSelectedDays((prev) => (prev.length === 7 ? [] : ALL_DAYS));
  };

  useFocusEffect(
    useCallback(() => {
      fetchMedication();
    }, [id])
  );

  // ─── Calcula la próxima dosis ───
  const getNextDoseTime = (med: Medication): string => {
    const [h, m] = med.start_time.split(':').map(Number);
    const now = new Date();
    const today = new Date();
    today.setHours(h, m, 0, 0);
    let next = new Date(today);
    while (next <= now) {
      next = new Date(next.getTime() + med.frequency_hours * 60 * 60 * 1000);
    }
    const hh = next.getHours().toString().padStart(2, '0');
    const mm = next.getMinutes().toString().padStart(2, '0');
    return `${hh}:${mm}`;
  };

  // ─── Eliminar (borrado suave: active = false) ───
  const handleDelete = () => {
    alert(
      'Eliminar medicamento',
      `${medication?.name} dejará de sonar y desaparecerá de tu lista. Tu historial de tomas se conserva.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            if (!medication) return;
            await cancelAllMedicationNotifications(medication.id);
            const { error } = await supabase
              .from('medications')
              .update({ active: false })
              .eq('id', medication.id);

            if (error) {
              snack('No se pudo eliminar. Revisa tu conexión.', { tone: 'error' });
              return;
            }
            snack(`${medication.name} se eliminó.`, { tone: 'success' });
            router.back();
          },
        },
      ]
    );
  };

  // ─── Confirmar que ya se borró manualmente la alarma vieja del Reloj ───
  // (Android no da forma de que la app la borre sola — ver notas en
  // handleSaveEdit y en lib/notifications.ts). Quita el recordatorio
  // persistente una vez que el usuario confirma haberlo hecho.
  const handleConfirmAlarmDeleted = () => {
    alert(
      '¿Ya borraste la alarma?',
      'Confirma que ya entraste a la app de Reloj de tu teléfono y borraste la alarma vieja de este medicamento.',
      [
        { text: 'Todavía no', style: 'cancel' },
        {
          text: 'Sí, ya la borré',
          onPress: async () => {
            if (!medication) return;
            const { data, error } = await supabase
              .from('medications')
              .update({ native_alarm_cleanup_pending: false })
              .eq('id', medication.id)
              .select()
              .single();
            if (!error && data) {
              setMedication(data);
              snack('Listo, ya no queda nada pendiente.', { tone: 'success' });
            }
          },
        },
      ]
    );
  };

  // ─── Selector de imagen ───
  const pickImage = async (fromCamera: boolean) => {
    let result: ImagePicker.ImagePickerResult;
    if (fromCamera) {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        alert('Falta el permiso de cámara', 'Para tomar la foto, activa el acceso a la cámara desde los ajustes del teléfono.');
        return;
      }
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
    } else {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        alert('Falta el permiso de galería', 'Para elegir una foto, activa el acceso a tus fotos desde los ajustes del teléfono.');
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
    }
    if (!result.canceled && result.assets[0]) {
      setEditImageUri(result.assets[0].uri);
    }
  };

  const showImageOptions = () => {
    sheet('Foto del medicamento', [
      { label: 'Tomar una foto', description: 'Usa la cámara del teléfono', icon: 'camera', onPress: () => pickImage(true) },
      { label: 'Elegir de la galería', description: 'Una foto que ya tienes', icon: 'images', onPress: () => pickImage(false) },
      ...(editImageUri
        ? [{ label: 'Quitar la foto', icon: 'trash-outline' as const, destructive: true, onPress: () => setEditImageUri(null) }]
        : []),
    ]);
  };

  // ─── Guardar cambios ───
  const handleSaveEdit = async () => {
    const found: EditErrors = {};
    if (!editName.trim()) found.name = 'Escribe cómo se llama.';
    if (!editDoseMg || isNaN(Number(editDoseMg)) || Number(editDoseMg) <= 0) {
      found.dose = 'Escribe cuántos miligramos, por ejemplo 500.';
    }
    if (editSelectedDays.length === 0) found.days = 'Elige al menos un día de la semana.';
    if (editRegimenType === 'por_tiempo') {
      if (!editDurationDays || isNaN(Number(editDurationDays)) || Number(editDurationDays) <= 0) {
        found.duration = 'Escribe por cuántos días, por ejemplo 7.';
      }
    }
    setErrors(found);
    if (Object.keys(found).length > 0) {
      snack('Faltan datos. Revisa lo que está marcado en rojo.', { tone: 'error' });
      return;
    }

    setSaving(true);

    // Solo recrear la alarma nativa si cambió el horario, la frecuencia o los
    // días (evita acumular alarmas duplicadas en el Reloj por cada edición).
    const daysChanged =
      editSelectedDays.length !== (medication?.days_of_week?.length ?? 7) ||
      [...editSelectedDays].sort().join(',') !== [...(medication?.days_of_week ?? ALL_DAYS)].sort().join(',');
    const scheduleChanged =
      editStartTime !== medication?.start_time ||
      Number(editFrequency) !== medication?.frequency_hours ||
      daysChanged;

    // Subir imagen nueva solo si cambió y es una URI local. editImageUri
    // arranca con lo que hay en la base (una ruta del bucket), así que la
    // comparación distingue "no la tocó" de "eligió otra".
    let photoUrl = medication?.photo_url ?? null;
    if (editImageUri && editImageUri !== medication?.photo_url) {
      const uploaded = await uploadMedicationPhoto(editImageUri, medication!.user_id);
      if (uploaded) {
        // La foto vieja ya no la referencia nadie: dejarla en el bucket sería
        // guardar un dato de salud que el usuario creyó haber reemplazado.
        await deleteMedicationPhoto(medication?.photo_url);
        photoUrl = uploaded;
      }
    } else if (!editImageUri) {
      await deleteMedicationPhoto(medication?.photo_url);
      photoUrl = null;
    }

    // Recalcular end_date solo si cambió el régimen o la duración — así una
    // edición menor (ej. la dosis) no reinicia la cuenta de días desde hoy.
    // Se ancla a created_at, no a "hoy", para que "por 7 días" siga contando
    // desde que empezó el tratamiento y no desde la fecha de esta edición.
    const durationChanged = Number(editDurationDays) !== medication?.duration_days;
    const regimenChanged = editRegimenType !== medication?.regimen_type;
    let endDate: string | null = medication?.end_date ?? null;
    if (editRegimenType === 'indefinido') {
      endDate = null;
    } else if (regimenChanged || durationChanged) {
      const end = new Date(medication!.created_at);
      end.setDate(end.getDate() + Number(editDurationDays));
      endDate = end.toISOString().slice(0, 10);
    }

    const { data, error } = await supabase
      .from('medications')
      .update({
        name: editName.trim(),
        dose_mg: Number(editDoseMg),
        frequency_hours: Number(editFrequency),
        start_time: editStartTime,
        days_of_week: editSelectedDays,
        photo_url: photoUrl,
        regimen_type: editRegimenType,
        duration_days: editRegimenType === 'por_tiempo' ? Number(editDurationDays) : null,
        end_date: endDate,
      })
      .eq('id', medication!.id)
      .select()
      .single();

    if (error) {
      snack('No se pudo guardar. Revisa tu conexión.', { tone: 'error' });
      setSaving(false);
      return;
    }

    // Reprogramar notificaciones — pero solo en el teléfono de la propia persona.
    // Las alarmas son locales al dispositivo; si esto se guarda desde el modo
    // cuidador, reprogramarlas aquí sonaría en el teléfono del cuidador, no en
    // el del paciente, así que en ese caso solo avisamos.
    if (data) {
      let finalData = data;

      // El medicamento acaba de dejar de ser "para siempre" y sí tenía una
      // alarma en el Reloj (has_native_alarm) — esa alarma NO se borra sola,
      // sin importar en qué teléfono se hizo esta edición. Se marca un
      // pendiente PERSISTENTE (banner en Inicio + tarjeta en el detalle)
      // hasta que el usuario confirme manualmente haberla borrado.
      const becamePorTiempo = regimenChanged && data.regimen_type === 'por_tiempo';
      if (becamePorTiempo && medication?.has_native_alarm) {
        const { data: flagged } = await supabase
          .from('medications')
          .update({ has_native_alarm: false, native_alarm_cleanup_pending: true })
          .eq('id', data.id)
          .select()
          .single();
        if (flagged) finalData = flagged;
      }

      if (!isViewingOther) {
        await cancelAllMedicationNotifications(data.id);
        await scheduleMedicationNotifications(data);
        // La alarma del Reloj solo aplica a tratamientos "para siempre" (ver
        // add.tsx) — Android no permite borrarla sola, así que para "por unos
        // días" solo usamos notificaciones locales. Se recrea si cambió el
        // horario, o si el medicamento acaba de volverse "para siempre" (antes
        // no tenía ninguna).
        if (data.regimen_type === 'indefinido' && (scheduleChanged || regimenChanged)) {
          const alarmResult = await scheduleNativeAlarms(data);
          if (alarmResult.attempted > 0 && alarmResult.succeeded === 0) {
            alert(
              'No se pudo crear la alarma',
              `El horario se guardó, pero no se pudo crear la alarma en el Reloj de tu teléfono.\n\nDetalle: ${alarmResult.errors[0] ?? 'error desconocido'}`
            );
          } else if (alarmResult.succeeded > 0) {
            // Si YA existía una alarma nativa antes de este cambio de horario,
            // la que se acaba de crear la deja huérfana en el Reloj (Android no
            // permite borrarla desde la app) — activar el mismo recordatorio
            // persistente (banner en Inicio + tarjeta en el detalle) que ya se
            // usa para el caso "para siempre → por unos días", en vez de confiar
            // solo en el aviso de abajo, que el usuario puede cerrar sin leer.
            const orphanedOldAlarm = Boolean(medication?.has_native_alarm) && scheduleChanged;
            const { data: refreshed } = await supabase
              .from('medications')
              .update({ has_native_alarm: true, native_alarm_cleanup_pending: orphanedOldAlarm })
              .eq('id', data.id)
              .select()
              .single();
            if (refreshed) finalData = refreshed;
            if (orphanedOldAlarm) {
              alert(
                'Horario cambiado',
                'Se creó una alarma nueva en el Reloj de tu teléfono. Dejamos un recordatorio permanente para que borres la anterior y no queden dos sonando.'
              );
            } else {
              snack('Horario cambiado. Se creó la alarma en el Reloj.', { tone: 'success' });
            }
          }
        } else if (becamePorTiempo && medication?.has_native_alarm) {
          alert(
            'Revisa la alarma del Reloj',
            'Este medicamento ya no crea alarmas nuevas en el Reloj porque ahora es "por unos días". Puede quedar una alarma vieja de cuando era "para siempre" — abajo dejamos un recordatorio permanente con los pasos para borrarla tú mismo.'
          );
        } else {
          snack('Cambios guardados.', { tone: 'success' });
        }
      } else if (scheduleChanged) {
        alert(
          'Guardado, pero falta un paso',
          `El horario se actualizó en la cuenta de ${activePatientLabel}, pero la alarma NO va a sonar hasta que esa persona abra PastilleroApp en su propio teléfono.`
        );
      } else {
        snack('Cambios guardados.', { tone: 'success' });
      }
      setMedication(finalData);
    }

    setSaving(false);
    setEditing(false);
  };

  // ─── Cargando ───
  if (loading || !medication) {
    return (
      <View style={styles.container}>
        <TopAppBar title="Detalle" variant="small" onBack={() => router.back()} />
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={scheme.primary} />
        </View>
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MODO EDICIÓN
  // ═══════════════════════════════════════════════════════════════════════
  if (editing) {
    return (
      <View style={styles.container}>
        <TopAppBar
          title="Editar"
          variant="small"
          onBack={() => {
            resetEditFields(medication);
            setEditing(false);
          }}
        />
        <PatientBanner />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ─── Foto ─── */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={editImageUri ? 'Cambiar la foto' : 'Agregar una foto'}
              onPress={showImageOptions}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Surface level={1} style={styles.photoCard}>
                <MedicationPhoto
                  source={editImageUri}
                  style={styles.photoThumb}
                  fallback={
                    <View style={[styles.photoPlaceholder, { backgroundColor: scheme.tertiaryContainer }]}>
                      <Ionicons name="camera-outline" size={38} color={scheme.onTertiaryContainer} />
                    </View>
                  }
                />
                <View style={styles.flex}>
                  <Text variant="titleSmall">{editImageUri ? 'Foto lista' : 'Agregar foto'}</Text>
                  <Text variant="bodySmall" tone="variant">
                    {editImageUri ? 'Toca para cambiarla o quitarla' : 'Ayuda a reconocer la pastilla'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={26} color={scheme.onSurfaceVariant} />
              </Surface>
            </Pressable>

            {/* ─── Grupo 1 ─── */}
            <Text variant="labelMedium" tone="variant" style={styles.groupLabel}>
              QUÉ MEDICAMENTO ES
            </Text>
            <Surface level={1} padded>
              <TextField
                label="Nombre"
                value={editName}
                onChangeText={(t) => {
                  setEditName(t);
                  clearError('name');
                }}
                placeholder="Metformina"
                autoCapitalize="words"
                error={errors.name}
              />
              <TextField
                label="Dosis"
                value={editDoseMg}
                onChangeText={(t) => {
                  setEditDoseMg(t);
                  clearError('dose');
                }}
                placeholder="500"
                keyboardType="numeric"
                suffix="mg"
                error={errors.dose}
                style={styles.fieldGap}
              />
            </Surface>

            {/* ─── Grupo 2 ─── */}
            <Text variant="labelMedium" tone="variant" style={styles.groupLabel}>
              CUÁNDO SUENA
            </Text>
            <Surface level={1} padded>
              <Text variant="titleSmall">¿Cada cuántas horas?</Text>
              <View style={styles.chipRow}>
                {FREQUENCY_OPTIONS.map((opt) => (
                  <Chip
                    key={opt.value}
                    label={opt.label}
                    selected={editFrequency === opt.value}
                    onPress={() => setEditFrequency(opt.value)}
                  />
                ))}
              </View>

              <View style={styles.divider} />

              <Text variant="titleSmall">¿A qué hora empieza?</Text>
              <View style={styles.timeGrid}>
                {TIME_OPTIONS.map((opt) => {
                  const active = editStartTime === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`${opt.label}, ${opt.sub}`}
                      onPress={() => setEditStartTime(opt.value)}
                      style={({ pressed }) => [
                        styles.timeOption,
                        {
                          backgroundColor: active ? scheme.primaryContainer : 'transparent',
                          borderColor: active ? 'transparent' : scheme.outline,
                          borderWidth: active ? 0 : 1,
                        },
                        pressed && styles.pressed,
                      ]}
                    >
                      <Ionicons
                        name={opt.icon}
                        size={26}
                        color={active ? scheme.onPrimaryContainer : scheme.onSurfaceVariant}
                      />
                      <Text
                        variant="labelMedium"
                        color={active ? scheme.onPrimaryContainer : scheme.onSurface}
                        center
                        style={styles.timeValue}
                      >
                        {opt.label}
                      </Text>
                      <Text
                        variant="labelSmall"
                        color={active ? scheme.onPrimaryContainer : scheme.onSurfaceVariant}
                        center
                      >
                        {opt.sub}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.divider} />

              <View style={styles.daysHeader}>
                <Text variant="titleSmall" style={styles.flex}>
                  ¿Qué días?
                </Text>
                <Button
                  title={editSelectedDays.length === 7 ? 'Quitar todos' : 'Todos'}
                  variant="text"
                  fullWidth={false}
                  onPress={selectAllEditDays}
                />
              </View>
              <View style={styles.chipRow}>
                {DAYS_OF_WEEK.map((day) => (
                  <Chip
                    key={day.value}
                    label={day.label}
                    subLabel={day.full}
                    selected={editSelectedDays.includes(day.value)}
                    onPress={() => toggleEditDay(day.value)}
                    style={styles.dayChip}
                  />
                ))}
              </View>
              {!!errors.days && (
                <Text variant="bodySmall" tone="error" style={styles.groupError}>
                  {errors.days}
                </Text>
              )}
            </Surface>

            {/* ─── Grupo 3 ─── */}
            <Text variant="labelMedium" tone="variant" style={styles.groupLabel}>
              POR CUÁNTO TIEMPO
            </Text>
            <Surface level={1} padded>
              <Text variant="titleSmall">¿Lo vas a tomar para siempre o por unos días?</Text>
              <View style={styles.chipRow}>
                <Chip
                  label="Para siempre"
                  selected={editRegimenType === 'indefinido'}
                  onPress={() => setEditRegimenType('indefinido')}
                />
                <Chip
                  label="Por unos días"
                  selected={editRegimenType === 'por_tiempo'}
                  onPress={() => setEditRegimenType('por_tiempo')}
                />
              </View>
              {editRegimenType === 'por_tiempo' && (
                <TextField
                  label="¿Por cuántos días?"
                  value={editDurationDays}
                  onChangeText={(t) => {
                    setEditDurationDays(t);
                    clearError('duration');
                  }}
                  placeholder="7"
                  keyboardType="numeric"
                  suffix="días"
                  supportingText="Los días se cuentan desde que agregaste el medicamento."
                  error={errors.duration}
                  style={styles.fieldGap}
                />
              )}
            </Surface>
          </ScrollView>

          <View
            style={[
              styles.actionBar,
              {
                backgroundColor: scheme.surfaceContainer,
                borderTopColor: scheme.outlineVariant,
                paddingBottom: insets.bottom + SPACING.lg,
              },
              elevation(2, scheme),
            ]}
          >
            <Button
              title="Guardar cambios"
              icon="checkmark-circle"
              emphasis
              loading={saving}
              onPress={handleSaveEdit}
            />
          </View>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MODO LECTURA
  // ═══════════════════════════════════════════════════════════════════════
  const durationLabel =
    medication.regimen_type === 'por_tiempo'
      ? `${medication.duration_days} días${
          medication.end_date
            ? ` · termina el ${new Date(`${medication.end_date}T00:00:00`).toLocaleDateString('es-MX', {
                day: 'numeric',
                month: 'long',
              })}`
            : ''
        }`
      : 'Para siempre';

  return (
    <View style={styles.container}>
      <TopAppBar
        title="Detalle"
        variant="small"
        onBack={() => router.back()}
        actions={[{ icon: 'create-outline', label: 'Editar medicamento', onPress: () => setEditing(true) }]}
      />
      <PatientBanner />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + SPACING.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Identidad del medicamento ─── */}
        <Surface level={1} padded style={styles.hero}>
          <MedicationPhoto
            source={medication.photo_url}
            style={styles.heroImage}
            fallback={
              <View style={[styles.heroPlaceholder, { backgroundColor: scheme.tertiaryContainer }]}>
                <BrandMark
                  size={52}
                  boxColor={withAlpha(scheme.onTertiaryContainer, 0.2)}
                  pillColor={scheme.onTertiaryContainer}
                />
              </View>
            }
          />
          <Text variant="headlineSmall" center style={styles.heroName}>
            {medication.name}
          </Text>
          <Text variant="titleMedium" tone="variant" center>
            {medication.dose_mg} mg
          </Text>
        </Surface>

        {/* ─── Los hechos del tratamiento: una lista, no cinco tarjetas ─── */}
        <Text variant="labelMedium" tone="variant" style={styles.groupLabel}>
          EL TRATAMIENTO
        </Text>
        <Surface level={1} padded>
          <ListItem
            leading={<IconBadge name="repeat" color={scheme.primary} backgroundColor={scheme.primaryContainer} size={48} />}
            overline="Frecuencia"
            headline={`Cada ${medication.frequency_hours} horas`}
          />
          <ListDivider />
          <ListItem
            leading={<IconBadge name="play" color={scheme.secondary} backgroundColor={scheme.secondaryContainer} size={48} />}
            overline="Hora de inicio"
            headline={formatTime12h(medication.start_time)}
          />
          <ListDivider />
          <ListItem
            leading={
              <IconBadge
                name="alarm"
                color={scheme.onWarningContainer}
                backgroundColor={scheme.warningContainer}
                size={48}
              />
            }
            overline="Próxima toma"
            headline={getNextDoseTime(medication)}
            headlineColor={scheme.warning}
          />
          <ListDivider />
          <ListItem
            leading={
              <IconBadge
                name="hourglass"
                color={scheme.onTertiaryContainer}
                backgroundColor={scheme.tertiaryContainer}
                size={48}
              />
            }
            overline="Duración"
            headline={durationLabel}
          />
          <ListDivider />
          <ListItem
            leading={<IconBadge name="calendar" color={scheme.onSurfaceVariant} backgroundColor={scheme.surfaceVariant} size={48} />}
            overline="Agregado"
            headline={new Date(medication.created_at).toLocaleDateString('es-MX', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          />
        </Surface>

        {/* ─── Pendiente: alarma vieja del Reloj sin borrar ─── */}
        {medication.native_alarm_cleanup_pending && (
          <>
            <Text variant="labelMedium" tone="variant" style={styles.groupLabel}>
              PENDIENTE
            </Text>
            <Surface level={1} padded borderColor={scheme.warning}>
              <View style={styles.pendingHeader}>
                <IconBadge
                  name="warning"
                  color={scheme.onWarningContainer}
                  backgroundColor={scheme.warningContainer}
                  size={48}
                />
                <Text variant="titleSmall" style={styles.flex}>
                  Borra la alarma vieja del Reloj
                </Text>
              </View>
              <Text variant="bodySmall" tone="variant" style={styles.pendingBody}>
                Este medicamento era &quot;para siempre&quot; y puede haber quedado una alarma activa en la
                app de Reloj de tu teléfono. Como ahora es &quot;por unos días&quot;, PastilleroApp ya no la
                controla y no puede borrarla sola.
              </Text>

              <View style={[styles.steps, { backgroundColor: scheme.surfaceContainer }]}>
                {[
                  'Abre la app de Reloj (no PastilleroApp).',
                  'Ve a la pestaña de Alarmas.',
                  `Busca la alarma de "${medication.name} ${medication.dose_mg}mg — abre PastilleroApp y confirma".`,
                  'Bórrala.',
                ].map((step, index) => (
                  <View key={index} style={styles.step}>
                    <View style={[styles.stepNumber, { backgroundColor: scheme.warningContainer }]}>
                      <Text variant="labelSmall" tone="onWarningContainer">
                        {index + 1}
                      </Text>
                    </View>
                    <Text variant="bodySmall" style={styles.flex}>
                      {step}
                    </Text>
                  </View>
                ))}
              </View>

              <Button
                title="Ya la borré"
                icon="checkmark-circle"
                variant="warning"
                onPress={handleConfirmAlarmDeleted}
                style={styles.pendingAction}
              />
            </Surface>
          </>
        )}

        <Button
          title="Eliminar medicamento"
          icon="trash-outline"
          variant="destructive"
          onPress={handleDelete}
          style={styles.deleteButton}
        />
      </ScrollView>
    </View>
  );
}

const makeStyles = (t: ColorScheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.background,
    },
    flex: {
      flex: 1,
    },
    loadingBox: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scroll: {
      paddingHorizontal: SCREEN_MARGIN,
      paddingBottom: SPACING.xxl,
    },
    pressed: {
      opacity: 0.85,
    },
    // ─── Lectura ───
    hero: {
      alignItems: 'center',
      paddingVertical: SPACING.xxl,
    },
    heroImage: {
      width: 132,
      height: 132,
      borderRadius: SHAPE.large,
      marginBottom: SPACING.lg,
    },
    heroPlaceholder: {
      width: 132,
      height: 132,
      borderRadius: SHAPE.large,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: SPACING.lg,
    },
    heroName: {
      marginBottom: SPACING.xs,
    },
    groupLabel: {
      marginTop: SPACING.xxl,
      marginBottom: SPACING.md,
    },
    groupError: {
      marginTop: SPACING.sm,
    },
    // ─── Pendiente del Reloj ───
    pendingHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      marginBottom: SPACING.md,
    },
    pendingBody: {
      marginBottom: SPACING.lg,
    },
    steps: {
      borderRadius: SHAPE.medium,
      padding: SPACING.lg,
      gap: SPACING.md,
    },
    step: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.md,
    },
    stepNumber: {
      width: 28,
      height: 28,
      borderRadius: SHAPE.full,
      justifyContent: 'center',
      alignItems: 'center',
    },
    pendingAction: {
      marginTop: SPACING.lg,
    },
    deleteButton: {
      marginTop: SPACING.xxxl,
    },
    // ─── Edición ───
    photoCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.lg,
      padding: SPACING.lg,
      minHeight: TOUCH.primary,
    },
    photoThumb: {
      width: 72,
      height: 72,
      borderRadius: SHAPE.medium,
    },
    photoPlaceholder: {
      width: 72,
      height: 72,
      borderRadius: SHAPE.medium,
      justifyContent: 'center',
      alignItems: 'center',
    },
    fieldGap: {
      marginTop: SPACING.xl,
    },
    divider: {
      height: 1,
      backgroundColor: t.outlineVariant,
      marginVertical: SPACING.xl,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.sm,
      marginTop: SPACING.md,
    },
    dayChip: {
      minWidth: 76,
    },
    timeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.sm,
      marginTop: SPACING.md,
    },
    timeOption: {
      flexGrow: 1,
      flexBasis: '46%',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 104,
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.sm,
      borderRadius: SHAPE.medium,
    },
    timeValue: {
      marginTop: SPACING.sm,
    },
    daysHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    actionBar: {
      paddingHorizontal: SCREEN_MARGIN,
      paddingTop: SPACING.lg,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
  });
