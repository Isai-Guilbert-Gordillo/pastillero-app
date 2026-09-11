import DonMemo from '@/components/DonMemo';
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
import React, { useEffect, useState } from 'react';
import {
    BackHandler,
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

// ─── Los pasos del asistente ─────────────────────────────────────────────────
// Una pregunta por pantalla. Don Memo la hace; el control de abajo la contesta.
// Sus líneas apuntan a la caja o a la receta cuando hace falta, pero NUNCA
// dicen qué tomar ni cuánto: eso lo escribe la persona (ver *La Regla de Don
// Memo Callado* en DESIGN.md).
const STEPS = [
  {
    key: 'foto',
    pregunta: '¿Le tomamos una foto?',
    memo: 'Así reconoces la pastilla de un vistazo. Si no quieres, la saltamos — no hace falta.',
    campos: [] as (keyof FormErrors)[],
  },
  {
    key: 'que',
    pregunta: '¿Qué medicina es?',
    memo: 'Copia el nombre y los miligramos tal como vienen en la caja.',
    campos: ['name', 'dose'] as (keyof FormErrors)[],
  },
  {
    key: 'cada',
    pregunta: '¿Cada cuántas horas?',
    memo: 'Si no te acuerdas, viene en la receta.',
    campos: ['frequency'] as (keyof FormErrors)[],
  },
  {
    key: 'hora',
    pregunta: '¿A qué hora es la primera?',
    memo: 'La del día. Las demás las calculo yo solo.',
    campos: [] as (keyof FormErrors)[],
  },
  {
    key: 'dias',
    pregunta: '¿Qué días la tomas?',
    memo: 'Si es todos, déjalo como está.',
    campos: ['days'] as (keyof FormErrors)[],
  },
  {
    key: 'cuanto',
    pregunta: '¿Por cuánto tiempo?',
    memo: 'Para siempre, o por unos días como un antibiótico.',
    campos: ['duration'] as (keyof FormErrors)[],
  },
  {
    key: 'resumen',
    pregunta: 'Revisemos juntos',
    memo: 'Si algo no cuadra, regresamos y lo cambiamos.',
    campos: [] as (keyof FormErrors)[],
  },
] as const;

const LAST_STEP = STEPS.length - 1;

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
  const [step, setStep] = useState(0);

  const clearError = (field: keyof FormErrors) => {
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };

  // El back del sistema retrocede un paso, igual que la flecha — y solo sale
  // de la pantalla cuando ya estás en el primero. Dejar que cierre la pantalla
  // a media captura tiraría todo lo escrito.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 0) return false;
      setStep((s) => s - 1);
      return true;
    });
    return () => sub.remove();
  }, [step]);

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

  /** Toma de `src` solo las claves pedidas que sí traen error. */
  const pickErrors = (src: FormErrors, keys: readonly (keyof FormErrors)[]): FormErrors => {
    const out: FormErrors = {};
    keys.forEach((k) => {
      if (src[k]) out[k] = src[k];
    });
    return out;
  };

  // Solo se valida lo del paso actual: marcar en rojo un campo que la persona
  // todavía no ha visto es regañarla por algo que no hizo.
  const goNext = () => {
    const found = pickErrors(validateForm(), STEPS[step].campos);
    if (Object.keys(found).length > 0) {
      setErrors((prev) => ({ ...prev, ...found }));
      return;
    }
    setStep((s) => Math.min(s + 1, LAST_STEP));
  };

  const goBack = () => {
    if (step === 0) {
      router.back();
      return;
    }
    setStep((s) => s - 1);
  };

  // El paso de resumen REEMPLAZA al diálogo de confirmación que había antes.
  // Sigue siendo una parada obligatoria —después de aquí suena una alarma real
  // en el teléfono— pero una pantalla que se recorre es mejor freno que un
  // modal que se cierra de un toque sin leerlo.
  const handleFinish = () => {
    const found = validateForm();
    setErrors(found);
    if (Object.keys(found).length === 0) {
      handleSave();
      return;
    }
    // Regresar al primer paso que tenga el problema, en vez de dejar a la
    // persona buscando dónde está el rojo.
    const culpable = STEPS.findIndex((s) => s.campos.some((c) => found[c]));
    snack('Falta un dato. Te regreso a donde está.', { tone: 'error' });
    if (culpable >= 0) setStep(culpable);
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
  const finalFrequencyLabel = frequencyHours === 'custom' ? customFrequency : frequencyHours;
  const daysLabel =
    selectedDays.length === 7
      ? 'Todos los días'
      : DAYS_OF_WEEK.filter((d) => selectedDays.includes(d.value)).map((d) => d.full).join(', ');
  const durationLabel =
    regimenType === 'indefinido' ? 'Para siempre' : `Por ${durationDays || '—'} días`;

  // ─── Paso 0: la foto ───
  const renderFoto = () => (
    <>
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
    </>
  );

  // ─── Paso 1: nombre y dosis ───
  const renderQue = () => (
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
  );

  // ─── Paso 2: cada cuántas horas ───
  const renderCada = () => (
    <Surface level={1} padded style={styles.group}>
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
    </Surface>
  );

  // ─── Paso 3: a qué hora empieza ───
  const renderHora = () => (
    <Surface level={1} padded style={styles.group}>
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
    </Surface>
  );

  // ─── Paso 4: qué días ───
  const renderDias = () => (
    <Surface level={1} padded style={styles.group}>
            <View style={styles.daysHeader}>
              <Text variant="titleSmall" style={styles.flex}>
                Días de la semana
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
  );

  // ─── Paso 5: por cuánto tiempo ───
  const renderCuanto = () => (
    <Surface level={1} padded style={styles.group}>
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
  );

  // ─── Paso 6: resumen ───
  // Sustituye al diálogo de confirmación: los mismos datos, pero en una
  // pantalla que hay que recorrer, no un modal que se cierra sin leer.
  const renderResumen = () => {
    const filas = [
      { icono: 'medical-outline' as const, etiqueta: 'Medicina', valor: `${name.trim() || '—'} · ${doseMg || '—'} mg`, paso: 1 },
      { icono: 'repeat-outline' as const, etiqueta: 'Cada', valor: `${finalFrequencyLabel || '—'} horas`, paso: 2 },
      { icono: 'alarm-outline' as const, etiqueta: 'Primera toma', valor: formatTime12h(startTime), paso: 3 },
      { icono: 'calendar-outline' as const, etiqueta: 'Días', valor: daysLabel || '—', paso: 4 },
      { icono: 'hourglass-outline' as const, etiqueta: 'Duración', valor: durationLabel, paso: 5 },
    ];
    return (
      <Surface level={1} padded style={styles.group}>
        {filas.map((f, i) => (
          <Pressable
            key={f.etiqueta}
            accessibilityRole="button"
            accessibilityLabel={`${f.etiqueta}: ${f.valor}. Tocar para cambiar.`}
            onPress={() => setStep(f.paso)}
            style={({ pressed }) => [
              styles.resumenFila,
              i > 0 && { borderTopWidth: 1, borderTopColor: scheme.outlineVariant },
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name={f.icono} size={26} color={scheme.primary} />
            <View style={styles.flex}>
              <Text variant="labelMedium" tone="variant">
                {f.etiqueta}
              </Text>
              <Text variant="titleSmall">{f.valor}</Text>
            </View>
            <Ionicons name="create-outline" size={22} color={scheme.onSurfaceVariant} />
          </Pressable>
        ))}
      </Surface>
    );
  };

  const CUERPOS = [renderFoto, renderQue, renderCada, renderHora, renderDias, renderCuanto, renderResumen];
  const paso = STEPS[step];

  return (
    <View style={styles.container}>
      <TopAppBar title="Nuevo medicamento" variant="small" onBack={goBack} />
      <PatientBanner />

      {/* Progreso: cuántos pasos faltan, dicho con número y con barra. */}
      <View style={styles.progress}>
        <Text variant="labelMedium" tone="variant">
          Paso {step + 1} de {STEPS.length}
        </Text>
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 1, max: STEPS.length, now: step + 1 }}
          style={[styles.track, { backgroundColor: scheme.surfaceVariant }]}
        >
          <View
            style={[
              styles.trackFill,
              { width: `${((step + 1) / STEPS.length) * 100}%`, backgroundColor: scheme.primary },
            ]}
          />
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Don Memo hace la pregunta; el control de abajo la contesta. */}
          <View style={styles.memoRow}>
            <DonMemo size={52} variant="head" gesture="nod" gestureKey={step} />
            <View style={styles.flex}>
              <Text variant="headlineSmall">{paso.pregunta}</Text>
              <Text variant="bodyMedium" tone="variant" style={styles.memoLine}>
                {paso.memo}
              </Text>
            </View>
          </View>

          {CUERPOS[step]()}

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

        {/* Barra de acción fija: el avance nunca queda enterrado al final de
            un scroll. Un solo `filled` por pantalla; "Atrás" es de texto
            porque retroceder no es lo que la persona vino a hacer. */}
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
          {step === LAST_STEP ? (
            <Button
              title="Guardar medicamento"
              icon="checkmark-circle"
              emphasis
              loading={saving}
              onPress={handleFinish}
            />
          ) : (
            <Button
              // En el paso de la foto el botón dice en voz alta que es
              // opcional, en vez de esconder el salto en un enlace chiquito.
              title={
                paso.key === 'foto' && !imageUri
                  ? 'Continuar sin foto'
                  : 'Siguiente'
              }
              icon="arrow-forward"
              emphasis
              onPress={goNext}
            />
          )}
          {step > 0 && (
            <Button title="Atrás" variant="text" onPress={goBack} style={styles.backButton} />
          )}
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
    // ─── Asistente paso a paso ───
    progress: {
      paddingHorizontal: SCREEN_MARGIN,
      paddingBottom: SPACING.md,
      gap: SPACING.sm,
    },
    track: {
      height: 6,
      borderRadius: SHAPE.full,
      overflow: 'hidden',
    },
    trackFill: {
      height: '100%',
      borderRadius: SHAPE.full,
    },
    memoRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.md,
      marginBottom: SPACING.xl,
    },
    memoLine: {
      marginTop: SPACING.xs,
    },
    resumenFila: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      minHeight: TOUCH.min,
      paddingVertical: SPACING.sm,
    },
    backButton: {
      marginTop: SPACING.xs,
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
    group: {
      marginBottom: SPACING.xs,
    },
    groupError: {
      marginTop: SPACING.sm,
    },
    fieldGap: {
      marginTop: SPACING.xl,
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
