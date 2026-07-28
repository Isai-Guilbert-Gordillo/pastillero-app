import { useFeedback } from '@/components/Feedback';
import PatientBanner from '@/components/PatientBanner';
import Button from '@/components/ui/Button';
import Chip from '@/components/ui/Chip';
import Surface from '@/components/ui/Surface';
import Text from '@/components/ui/Text';
import TextField from '@/components/ui/TextField';
import TopAppBar from '@/components/ui/TopAppBar';
import WebTimePicker from '@/components/WebTimePicker';
import { useCaregiver } from '@/context/CaregiverContext';
import { useTheme, useThemedStyles } from '@/context/ThemeContext';
import { computeDoseDates, scheduleMedicationNotifications, scheduleNativeAlarms } from '@/lib/notifications';
import { uploadMedicationPhoto } from '@/lib/photos';
import { supabase } from '@/lib/supabase';
import { ColorScheme, SCREEN_MARGIN, SHAPE, SPACING, TOUCH, elevation } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─────────────────────────────────────────────────────────────────────────────
// Alta de medicamento.
//
// Dejó de ser una pestaña. Agregar un medicamento es una TAREA con principio y
// fin, no un lugar al que se vuelve: ahora se abre a pantalla completa desde el
// FAB de Inicio, con flecha de retroceso y sin barra de navegación debajo.
//
// El formulario ya no es una pila de siete tarjetas blancas idénticas (una por
// campo), que hacía que "Nombre" pesara lo mismo que "¿Qué días?". Son tres
// grupos con sentido —qué es, cuándo suena, por cuánto tiempo— y dentro de cada
// grupo los campos comparten un solo contenedor.
//
// Los errores ya no son un modal: viven bajo el campo que los causó, nombran el
// problema y dicen la salida.
//
// Y el botón de guardar no está al final de un scroll largo: vive fijo en una
// barra inferior, siempre alcanzable.
// ─────────────────────────────────────────────────────────────────────────────

const FREQUENCY_OPTIONS = [
  { label: '4 h', value: '4' },
  { label: '6 h', value: '6' },
  { label: '8 h', value: '8' },
  { label: '12 h', value: '12' },
  { label: '24 h', value: '24' },
  { label: 'Otra', value: 'custom' },
];

const TIME_OPTIONS = [
  { icon: 'partly-sunny-outline', label: '6:00 AM', sub: 'Al despertar', value: '06:00' },
  { icon: 'sunny-outline', label: '8:00 AM', sub: 'Desayuno', value: '08:00' },
  { icon: 'restaurant-outline', label: '1:00 PM', sub: 'Comida', value: '13:00' },
  { icon: 'moon-outline', label: '8:00 PM', sub: 'Cena', value: '20:00' },
  { icon: 'bed-outline', label: '10:00 PM', sub: 'Al dormir', value: '22:00' },
  { icon: 'time-outline', label: 'Otra hora', sub: 'Elegir', value: 'custom' },
] as const;

const PRESET_TIMES = ['06:00', '08:00', '13:00', '20:00', '22:00'];

/** Convierte "HH:mm" (24 h) → "h:mm AM/PM" para mostrar al usuario */
const formatTime12h = (time24: string): string => {
  const [h, m] = time24.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
};

/** Devuelve texto amigable según la hora */
const getPeriodLabel = (time24: string): string => {
  const h = parseInt(time24.split(':')[0], 10);
  if (h >= 5 && h < 12) return 'Tu medicina sonará por la mañana';
  if (h >= 12 && h < 19) return 'Tu medicina sonará por la tarde';
  return 'Tu medicina sonará por la noche';
};

const DAYS_OF_WEEK = [
  { label: 'L', full: 'Lunes', value: 'mon' },
  { label: 'M', full: 'Martes', value: 'tue' },
  { label: 'Mi', full: 'Miércoles', value: 'wed' },
  { label: 'J', full: 'Jueves', value: 'thu' },
  { label: 'V', full: 'Viernes', value: 'fri' },
  { label: 'S', full: 'Sábado', value: 'sat' },
  { label: 'D', full: 'Domingo', value: 'sun' },
];

interface FormErrors {
  name?: string;
  dose?: string;
  frequency?: string;
  days?: string;
  duration?: string;
}

export default function AddMedicationScreen() {
  const { activePatientId, isViewingOther, activePatientLabel } = useCaregiver();
  const { scheme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { alert, snack, sheet } = useFeedback();

  const [name, setName] = useState('');
  const [doseMg, setDoseMg] = useState('');
  const [frequencyHours, setFrequencyHours] = useState('8');
  const [startTime, setStartTime] = useState('08:00');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [customFrequency, setCustomFrequency] = useState('');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempTime, setTempTime] = useState(new Date());
  const [selectedDays, setSelectedDays] = useState<string[]>([
    'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun',
  ]);
  const [regimenType, setRegimenType] = useState<'indefinido' | 'por_tiempo'>('indefinido');
  const [durationDays, setDurationDays] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  const clearError = (field: keyof FormErrors) => {
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };

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
      setImageUri(result.assets[0].uri);
    }
  };

  // Elegir entre cámara y galería son dos opciones equivalentes: eso es una hoja
  // inferior, no un diálogo. Un diálogo interrumpe para pedir una decisión con
  // consecuencias; aquí no hay ninguna.
  const showImageOptions = () => {
    sheet('Foto del medicamento', [
      { label: 'Tomar una foto', description: 'Usa la cámara del teléfono', icon: 'camera', onPress: () => pickImage(true) },
      { label: 'Elegir de la galería', description: 'Una foto que ya tienes', icon: 'images', onPress: () => pickImage(false) },
      ...(imageUri
        ? [{ label: 'Quitar la foto', icon: 'trash-outline' as const, destructive: true, onPress: () => setImageUri(null) }]
        : []),
    ]);
  };

  const toggleDay = (day: string) => {
    clearError('days');
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const selectAllDays = () => {
    clearError('days');
    setSelectedDays((prev) => (prev.length === 7 ? [] : DAYS_OF_WEEK.map((d) => d.value)));
  };

  const handleSelectFrequency = (value: string) => {
    clearError('frequency');
    if (value === 'custom') {
      setFrequencyHours('custom');
    } else {
      setFrequencyHours(value);
      setCustomFrequency('');
    }
  };

  const handleSelectTime = (value: string) => {
    if (value === 'custom') {
      // Inicializa el selector con la hora actualmente elegida
      const [h, m] = startTime.split(':').map(Number);
      const d = new Date();
      d.setHours(h, m, 0, 0);
      setTempTime(d);
      setShowTimePicker(true);
    } else {
      setStartTime(value);
    }
  };

  const onTimePickerChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowTimePicker(false);
    if (event.type === 'set' && selectedDate) {
      const h = String(selectedDate.getHours()).padStart(2, '0');
      const m = String(selectedDate.getMinutes()).padStart(2, '0');
      setStartTime(`${h}:${m}`);
    }
  };

  // Cada error nombra el problema Y la salida, y se muestra bajo el campo que lo
  // causó — no en un modal que hay que cerrar antes de poder arreglarlo.
  const validateForm = (): FormErrors => {
    const next: FormErrors = {};
    if (!name.trim()) next.name = 'Escribe cómo se llama, por ejemplo "Metformina".';
    if (!doseMg || isNaN(Number(doseMg)) || Number(doseMg) <= 0) {
      next.dose = 'Escribe cuántos miligramos, por ejemplo 500.';
    }
    const finalFrequency = frequencyHours === 'custom' ? customFrequency : frequencyHours;
    if (!finalFrequency || isNaN(Number(finalFrequency)) || Number(finalFrequency) <= 0) {
      next.frequency = 'Escribe cada cuántas horas se toma, por ejemplo 8.';
    }
    if (selectedDays.length === 0) next.days = 'Elige al menos un día de la semana.';
    if (regimenType === 'por_tiempo') {
      if (!durationDays || isNaN(Number(durationDays)) || Number(durationDays) <= 0) {
        next.duration = 'Escribe por cuántos días, por ejemplo 7.';
      }
    }
    return next;
  };

  // Resumen en lenguaje llano antes de guardar — para atrapar un dedazo
  // (ej. tocar "4 h" en vez de "8 h") antes de que se programe la alarma.
  // Esta SÍ es una decisión que debe interrumpir: después de aquí suena una
  // alarma real en el teléfono.
  const confirmAndSave = () => {
    const found = validateForm();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      snack('Faltan datos. Revisa lo que está marcado en rojo.', { tone: 'error' });
      return;
    }
    const finalFrequency = frequencyHours === 'custom' ? customFrequency : frequencyHours;
    const daysLabel =
      selectedDays.length === 7
        ? 'Todos los días'
        : DAYS_OF_WEEK.filter((d) => selectedDays.includes(d.value)).map((d) => d.full).join(', ');
    const durationLabel =
      regimenType === 'indefinido' ? 'Para siempre' : `Por ${durationDays} días`;

    alert(
      'Revisa antes de guardar',
      `${name.trim()} — ${doseMg} mg\nCada ${finalFrequency} horas, empezando a las ${formatTime12h(startTime)}\nDías: ${daysLabel}\nDuración: ${durationLabel}`,
      [
        { text: 'Corregir', style: 'cancel' },
        { text: 'Guardar', onPress: handleSave },
      ]
    );
  };

  const handleSave = async () => {
    if (!activePatientId) return;
    const found = validateForm();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const finalFrequency = frequencyHours === 'custom' ? customFrequency : frequencyHours;

    setSaving(true);

    // Se guarda la ruta dentro del bucket, no una URL: el bucket es privado y
    // la foto se firma al mostrarla (ver lib/photos.ts).
    let photoUrl: string | null = null;
    if (imageUri) {
      photoUrl = await uploadMedicationPhoto(imageUri, activePatientId);
    }

    let endDate: string | null = null;
    if (regimenType === 'por_tiempo') {
      const end = new Date();
      end.setDate(end.getDate() + Number(durationDays));
      endDate = end.toISOString().slice(0, 10);
    }

    const { data, error } = await supabase
      .from('medications')
      .insert({
        user_id: activePatientId,
        name: name.trim(),
        photo_url: photoUrl,
        dose_mg: Number(doseMg),
        frequency_hours: Number(finalFrequency),
        start_time: startTime,
        days_of_week: selectedDays,
        regimen_type: regimenType,
        duration_days: regimenType === 'por_tiempo' ? Number(durationDays) : null,
        end_date: endDate,
        active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Insert error:', error);
      setSaving(false);
      alert('No se pudo guardar', 'Revisa tu conexión a internet y vuelve a tocar Guardar.');
      return;
    }

    if (!data) {
      setSaving(false);
      snack(`${name.trim()} se agregó.`, { tone: 'success' });
      router.back();
      return;
    }

    // Las alarmas son locales al teléfono que las programa. Si estamos actuando
    // como cuidador (en el teléfono de otra persona), programarlas aquí sonaría
    // en ESTE teléfono, no en el de esa persona — así que las omitimos y
    // avisamos claramente en su lugar.
    let alarmResult: { attempted: number; succeeded: number; errors: string[] } = {
      attempted: 0,
      succeeded: 0,
      errors: [],
    };
    if (!isViewingOther) {
      const notifIds = await scheduleMedicationNotifications(data);
      if (notifIds.length > 0) {
        await supabase
          .from('medications')
          .update({ notification_ids: notifIds })
          .eq('id', data.id);
      }
      // Alarma nativa del Reloj — suena aunque la app esté cerrada, pero Android no
      // da forma de borrarla sola. Por eso solo se crea para tratamientos "para
      // siempre": ahí ese problema no importa, nunca hay que borrarla. Para
      // tratamientos "por unos días" solo usamos notificaciones locales, que sí
      // podemos cancelar solos cuando el tratamiento termine.
      if (data.regimen_type === 'indefinido') {
        alarmResult = await scheduleNativeAlarms(data);
        if (alarmResult.succeeded > 0) {
          await supabase
            .from('medications')
            .update({ has_native_alarm: true })
            .eq('id', data.id);
        }
      }
    }

    const doseDates = computeDoseDates(data);

    // Insertar primer registro de dosis con scheduled_at = primera toma real
    if (doseDates.length > 0) {
      await supabase.from('dose_records').insert({
        medication_id: data.id,
        user_id: activePatientId,
        scheduled_at: doseDates[0].toISOString(),
        taken: null, // pendiente
        responded_at: null,
      });
    }

    setSaving(false);

    if (isViewingOther) {
      alert(
        'Guardado, pero falta un paso',
        `"${name.trim()}" ya quedó en la cuenta de ${activePatientLabel}.\n\nLa alarma NO va a sonar hasta que esa persona abra PastilleroApp en su propio teléfono al menos una vez — solo ahí se programa el sonido.`,
        [{ text: 'Entendido', onPress: () => router.back() }]
      );
      return;
    }

    if (alarmResult.attempted > 0 && alarmResult.succeeded === 0) {
      alert(
        'Guardado, pero sin alarma del Reloj',
        `No se pudo crear la alarma en el Reloj de tu teléfono.\n\nDetalle: ${alarmResult.errors[0] ?? 'error desconocido'}\n\nLas notificaciones de la app sí quedaron programadas.`,
        [{ text: 'Entendido', onPress: () => router.back() }]
      );
      return;
    }

    snack(`${name.trim()} se agregó. La alarma ya está programada.`, { tone: 'success' });
    router.back();
  };

  const isCustomTime = !PRESET_TIMES.includes(startTime);

  return (
    <View style={styles.container}>
      <TopAppBar title="Nuevo medicamento" variant="small" onBack={() => router.back()} />
      <PatientBanner />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ─── Foto ─── */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={imageUri ? 'Cambiar la foto del medicamento' : 'Agregar una foto del medicamento'}
            onPress={showImageOptions}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Surface level={1} style={styles.photoCard}>
              {imageUri ? (
                <>
                  <Image source={{ uri: imageUri }} style={styles.photo} contentFit="cover" />
                  <View style={styles.photoInfo}>
                    <Text variant="titleSmall">Foto lista</Text>
                    <Text variant="bodySmall" tone="variant">
                      Toca para cambiarla o quitarla
                    </Text>
                  </View>
                  <Ionicons name="create-outline" size={26} color={scheme.onSurfaceVariant} />
                </>
              ) : (
                <>
                  <View style={[styles.photoPlaceholder, { backgroundColor: scheme.tertiaryContainer }]}>
                    <Ionicons name="camera-outline" size={38} color={scheme.onTertiaryContainer} />
                  </View>
                  <View style={styles.photoInfo}>
                    <Text variant="titleSmall">Agregar foto</Text>
                    <Text variant="bodySmall" tone="variant">
                      Ayuda a reconocer la pastilla de un vistazo
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={26} color={scheme.onSurfaceVariant} />
                </>
              )}
            </Surface>
          </Pressable>

          {/* ─── Grupo 1: qué es ─── */}
          <Text variant="labelMedium" tone="variant" style={styles.groupLabel}>
            QUÉ MEDICAMENTO ES
          </Text>
          <Surface level={1} padded style={styles.group}>
            <TextField
              label="Nombre"
              placeholder="Metformina"
              value={name}
              onChangeText={(t) => {
                setName(t);
                clearError('name');
              }}
              autoCapitalize="words"
              error={errors.name}
            />
            <TextField
              label="Dosis"
              placeholder="500"
              value={doseMg}
              onChangeText={(t) => {
                setDoseMg(t);
                clearError('dose');
              }}
              keyboardType="numeric"
              suffix="mg"
              error={errors.dose}
              style={styles.fieldGap}
            />
          </Surface>

          {/* ─── Grupo 2: cuándo suena ─── */}
          <Text variant="labelMedium" tone="variant" style={styles.groupLabel}>
            CUÁNDO SUENA
          </Text>
          <Surface level={1} padded style={styles.group}>
            <Text variant="titleSmall">¿Cada cuántas horas?</Text>
            <View style={styles.chipRow}>
              {FREQUENCY_OPTIONS.map((opt) => (
                <Chip
                  key={opt.value}
                  label={opt.label}
                  selected={opt.value === 'custom' ? frequencyHours === 'custom' : frequencyHours === opt.value}
                  onPress={() => handleSelectFrequency(opt.value)}
                />
              ))}
            </View>
            {frequencyHours === 'custom' && (
              <TextField
                label="Cada cuántas horas"
                placeholder="3"
                value={customFrequency}
                onChangeText={(t) => {
                  setCustomFrequency(t);
                  clearError('frequency');
                }}
                keyboardType="numeric"
                suffix="horas"
                error={errors.frequency}
                style={styles.fieldGap}
              />
            )}
            {!!errors.frequency && frequencyHours !== 'custom' && (
              <Text variant="bodySmall" tone="error" style={styles.groupError}>
                {errors.frequency}
              </Text>
            )}

            <View style={styles.divider} />

            <Text variant="titleSmall">¿A qué hora empieza?</Text>
            <View style={styles.timeGrid}>
              {TIME_OPTIONS.map((opt) => {
                const active = opt.value === 'custom' ? isCustomTime : startTime === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${opt.label}, ${opt.sub}`}
                    onPress={() => handleSelectTime(opt.value)}
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
                      {opt.value === 'custom' && active ? formatTime12h(startTime) : opt.label}
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

            {/* Confirmación en lenguaje llano de lo que se acaba de elegir */}
            <View style={[styles.confirmStrip, { backgroundColor: scheme.surfaceContainer }]}>
              <Ionicons name="volume-high-outline" size={24} color={scheme.primary} />
              <View style={styles.flex}>
                <Text variant="labelMedium" tone="primary">
                  {getPeriodLabel(startTime)}
                </Text>
                <Text variant="bodySmall" tone="variant">
                  Primera toma: {formatTime12h(startTime)}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.daysHeader}>
              <Text variant="titleSmall" style={styles.flex}>
                ¿Qué días?
              </Text>
              <Button
                title={selectedDays.length === 7 ? 'Quitar todos' : 'Todos'}
                variant="text"
                fullWidth={false}
                onPress={selectAllDays}
              />
            </View>
            <View style={styles.chipRow}>
              {DAYS_OF_WEEK.map((day) => (
                <Chip
                  key={day.value}
                  label={day.label}
                  subLabel={day.full}
                  selected={selectedDays.includes(day.value)}
                  onPress={() => toggleDay(day.value)}
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

          {/* ─── Grupo 3: por cuánto tiempo ─── */}
          <Text variant="labelMedium" tone="variant" style={styles.groupLabel}>
            POR CUÁNTO TIEMPO
          </Text>
          <Surface level={1} padded style={styles.group}>
            <Text variant="titleSmall">¿Lo vas a tomar para siempre o por unos días?</Text>
            <View style={styles.chipRow}>
              <Chip
                label="Para siempre"
                selected={regimenType === 'indefinido'}
                onPress={() => setRegimenType('indefinido')}
              />
              <Chip
                label="Por unos días"
                selected={regimenType === 'por_tiempo'}
                onPress={() => setRegimenType('por_tiempo')}
              />
            </View>
            {regimenType === 'por_tiempo' && (
              <TextField
                label="¿Por cuántos días?"
                placeholder="7"
                value={durationDays}
                onChangeText={(t) => {
                  setDurationDays(t);
                  clearError('duration');
                }}
                keyboardType="numeric"
                suffix="días"
                supportingText="Al terminar, PastilleroApp te va a preguntar si ya acabaste."
                error={errors.duration}
                style={styles.fieldGap}
              />
            )}
          </Surface>

          {/* ─── Selector de hora: nativo en Android/iOS, propio en web ─── */}
          {showTimePicker && Platform.OS !== 'web' && (
            <DateTimePicker
              value={tempTime}
              mode="time"
              is24Hour={false}
              display="default"
              onChange={onTimePickerChange}
            />
          )}
          {Platform.OS === 'web' && (
            <WebTimePicker
              visible={showTimePicker}
              initialTime={startTime}
              onCancel={() => setShowTimePicker(false)}
              onConfirm={(time24) => {
                setShowTimePicker(false);
                setStartTime(time24);
              }}
            />
          )}
        </ScrollView>

        {/* Barra de acción fija: el botón de guardar nunca queda enterrado al
            final de un scroll largo. */}
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
            title="Guardar medicamento"
            icon="checkmark-circle"
            emphasis
            loading={saving}
            onPress={confirmAndSave}
          />
        </View>
      </KeyboardAvoidingView>
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
    scroll: {
      paddingHorizontal: SCREEN_MARGIN,
      paddingBottom: SPACING.xxl,
    },
    pressed: {
      opacity: 0.85,
    },
    // ─── Foto ───
    photoCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.lg,
      padding: SPACING.lg,
      minHeight: TOUCH.primary,
    },
    photo: {
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
    photoInfo: {
      flex: 1,
    },
    // ─── Grupos ───
    groupLabel: {
      marginTop: SPACING.xxl,
      marginBottom: SPACING.md,
    },
    group: {
      marginBottom: SPACING.xs,
    },
    groupError: {
      marginTop: SPACING.sm,
    },
    fieldGap: {
      marginTop: SPACING.xl,
    },
    divider: {
      height: 1,
      backgroundColor: t.outlineVariant,
      marginVertical: SPACING.xl,
    },
    // ─── Chips ───
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.sm,
      marginTop: SPACING.md,
    },
    dayChip: {
      minWidth: 76,
    },
    // ─── Cuadrícula de horarios ───
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
    confirmStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      borderRadius: SHAPE.medium,
      padding: SPACING.lg,
      marginTop: SPACING.lg,
    },
    daysHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    // ─── Barra de acción fija ───
    actionBar: {
      paddingHorizontal: SCREEN_MARGIN,
      paddingTop: SPACING.lg,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
  });
