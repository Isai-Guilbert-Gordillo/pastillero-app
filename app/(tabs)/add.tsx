import { useAppAlert } from '@/components/AppAlert';
import PatientBanner from '@/components/PatientBanner';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import IconBadge from '@/components/ui/IconBadge';
import WebTimePicker from '@/components/WebTimePicker';
import { useCaregiver } from '@/context/CaregiverContext';
import { computeDoseDates, scheduleMedicationNotifications, scheduleNativeAlarms } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { BORDER_RADIUS, COLORS, FONTS, SPACING, TOUCH_TARGET } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

const FREQUENCY_OPTIONS = [
  { label: 'Cada 4h', value: '4' },
  { label: 'Cada 6h', value: '6' },
  { label: 'Cada 8h', value: '8' },
  { label: 'Cada 12h', value: '12' },
  { label: 'Cada 24h', value: '24' },
  { label: 'Otra', value: 'custom' },
];

const TIME_OPTIONS = [
  { label: '🌅 6:00 AM', sub: 'Desayuno', value: '06:00' },
  { label: '☀️ 8:00 AM', sub: 'Mañana', value: '08:00' },
  { label: '🍽️ 1:00 PM', sub: 'Comida', value: '13:00' },
  { label: '🌙 8:00 PM', sub: 'Cena', value: '20:00' },
  { label: '😴 10:00 PM', sub: 'Noche', value: '22:00' },
  { label: '⏰ Otra', sub: 'Personalizar', value: 'custom' },
];

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
  if (h >= 5 && h < 12) return '🌅 Tu medicina sonará por la mañana';
  if (h >= 12 && h < 19) return '☀️ Tu medicina sonará por la tarde';
  return '🌙 Tu medicina sonará por la noche';
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

export default function AddMedicationScreen() {
  const { activePatientId, isViewingOther, activePatientLabel } = useCaregiver();
  const router = useRouter();
  const { alert } = useAppAlert();
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

  // Limpia el formulario — se llama tras guardar y cada vez que se entra a esta pestaña,
  // porque expo-router mantiene la pantalla montada al cambiar de tab (si no, quedan
  // los datos del medicamento anterior).
  const resetForm = () => {
    setName('');
    setDoseMg('');
    setFrequencyHours('8');
    setStartTime('08:00');
    setImageUri(null);
    setCustomFrequency('');
    setSelectedDays(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
  };

  useFocusEffect(
    useCallback(() => {
      resetForm();
    }, [])
  );

  const pickImage = async (fromCamera: boolean) => {
    let result: ImagePicker.ImagePickerResult;

    if (fromCamera) {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        alert('Permiso necesario', 'Necesitamos acceso a la cámara para tomar fotos.');
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
        alert('Permiso necesario', 'Necesitamos acceso a tu galería.');
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

  const showImageOptions = () => {
    alert('Seleccionar foto', '¿De dónde quieres obtener la foto?', [
      { text: 'Cámara', onPress: () => pickImage(true) },
      { text: 'Galería', onPress: () => pickImage(false) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const selectAllDays = () => {
    if (selectedDays.length === 7) {
      setSelectedDays([]);
    } else {
      setSelectedDays(DAYS_OF_WEEK.map((d) => d.value));
    }
  };

  const handleSelectFrequency = (value: string) => {
    if (value === 'custom') {
      setFrequencyHours('custom');
    } else {
      setFrequencyHours(value);
      setCustomFrequency('');
    }
  };

  const handleSelectTime = (value: string) => {
    if (value === 'custom') {
      // Initialize picker with the current startTime
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

  const uploadImage = async (uri: string): Promise<string | null> => {
    try {
      const fileName = `${activePatientId}/${Date.now()}.jpg`;
      const response = await fetch(uri);
      const blob = await response.blob();

      const arrayBuffer = await new Response(blob).arrayBuffer();

      const { error } = await supabase.storage
        .from('medication-photos')
        .upload(fileName, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (error) {
        console.error('Upload error:', error);
        return null;
      }

      const { data } = supabase.storage
        .from('medication-photos')
        .getPublicUrl(fileName);

      return data.publicUrl;
    } catch (err) {
      console.error('Upload exception:', err);
      return null;
    }
  };

  const validateForm = (): string | null => {
    if (!name.trim()) return 'Ingresa el nombre del medicamento';
    if (!doseMg || isNaN(Number(doseMg)) || Number(doseMg) <= 0) return 'Ingresa una dosis válida en mg';
    const finalFrequency = frequencyHours === 'custom' ? customFrequency : frequencyHours;
    if (!finalFrequency || isNaN(Number(finalFrequency)) || Number(finalFrequency) <= 0) {
      return 'Selecciona cada cuántas horas';
    }
    if (selectedDays.length === 0) return 'Selecciona al menos un día de la semana';
    return null;
  };

  // Resumen en lenguaje llano antes de guardar — para atrapar un dedazo
  // (ej. tocar "Cada 4h" en vez de "Cada 8h") antes de que se programe la alarma.
  const confirmAndSave = () => {
    const validationError = validateForm();
    if (validationError) {
      alert('Error', validationError);
      return;
    }
    const finalFrequency = frequencyHours === 'custom' ? customFrequency : frequencyHours;
    const daysLabel =
      selectedDays.length === 7
        ? 'Todos los días'
        : DAYS_OF_WEEK.filter((d) => selectedDays.includes(d.value)).map((d) => d.full).join(', ');

    alert(
      'Confirma los datos',
      `${name.trim()} — ${doseMg} mg\nCada ${finalFrequency} horas, empezando a las ${formatTime12h(startTime)}\nDías: ${daysLabel}`,
      [
        { text: 'Revisar', style: 'cancel' },
        { text: 'Guardar', onPress: handleSave },
      ]
    );
  };

  const handleSave = async () => {
    if (!activePatientId) return;
    const validationError = validateForm();
    if (validationError) {
      alert('Error', validationError);
      return;
    }
    const finalFrequency = frequencyHours === 'custom' ? customFrequency : frequencyHours;

    setSaving(true);

    let photoUrl: string | null = null;
    if (imageUri) {
      photoUrl = await uploadImage(imageUri);
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
        active: true,
      })
      .select()
      .single();

    if (error) {
      alert('Error', 'No se pudo guardar el medicamento. Intenta de nuevo.');
      console.error('Insert error:', error);
      setSaving(false);
      return;
    }

    if (!data) {
      setSaving(false);
      alert('Listo', `"${name.trim()}" se agregó correctamente.`, [
        { text: 'OK', onPress: () => router.push('/(tabs)') },
      ]);
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
      // Alarma nativa del teléfono — suena aunque la app esté cerrada
      alarmResult = await scheduleNativeAlarms(data);
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
        '✅ Guardado, pero falta un paso',
        `"${name.trim()}" ya quedó en la cuenta de ${activePatientLabel}.\n\nLa alarma NO va a sonar hasta que esa persona abra PastilleroApp en su propio teléfono al menos una vez — solo ahí se programa el sonido.`,
        [{ text: 'Entendido', onPress: () => router.push('/(tabs)') }]
      );
      return;
    }

    if (alarmResult.attempted > 0 && alarmResult.succeeded === 0) {
      alert(
        'Medicamento guardado, pero...',
        `No se pudo crear la alarma en el Reloj de tu teléfono.\n\nDetalle: ${alarmResult.errors[0] ?? 'error desconocido'}\n\nLas notificaciones de la app sí quedaron programadas.`,
        [{ text: 'OK', onPress: () => router.push('/(tabs)') }]
      );
      return;
    }

    alert('Listo', `"${name.trim()}" se agregó correctamente.`, [
      { text: 'OK', onPress: () => router.push('/(tabs)') },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <PatientBanner />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ─── Header ─── */}
          <Animated.View entering={FadeInDown.duration(350)}>
            <Text style={styles.title}>Agregar Medicamento</Text>
            <Text style={styles.subtitle}>Completa los datos de tu medicina</Text>
          </Animated.View>

          {/* ─── Photo Card ─── */}
          <Animated.View entering={FadeInDown.duration(350).delay(40)}>
            <TouchableOpacity onPress={showImageOptions} activeOpacity={0.7}>
              <Card style={styles.photoCard}>
                {imageUri ? (
                  <Image source={{ uri: imageUri }} style={styles.photo} contentFit="cover" />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <IconBadge name="camera" color={COLORS.primary} backgroundColor={COLORS.primaryBg} size={80} iconSize={38} />
                    <Text style={styles.photoTitle}>Agregar foto</Text>
                    <Text style={styles.photoHint}>Toca para tomar o elegir una foto</Text>
                  </View>
                )}
              </Card>
            </TouchableOpacity>
          </Animated.View>

          {/* ─── Nombre Card ─── */}
          <Animated.View entering={FadeInDown.duration(350).delay(80)}>
            <Card style={styles.sectionCard}>
              <View style={styles.cardHeader}>
                <IconBadge name="medical" color={COLORS.accent} backgroundColor="#FFE4E8" />
                <Text style={styles.sectionLabel}>Nombre del medicamento</Text>
              </View>
              <View style={styles.inputInner}>
                <TextInput
                  style={styles.input}
                  placeholder="Ej: Metformina"
                  placeholderTextColor={COLORS.textLight}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>
            </Card>
          </Animated.View>

          {/* ─── Dosis Card ─── */}
          <Animated.View entering={FadeInDown.duration(350).delay(120)}>
            <Card style={styles.sectionCard}>
              <View style={styles.cardHeader}>
                <IconBadge name="fitness" color={COLORS.accent} backgroundColor="#FFE4E8" />
                <Text style={styles.sectionLabel}>Dosis</Text>
              </View>
              <View style={styles.inputInner}>
                <TextInput
                  style={styles.input}
                  placeholder="Ej: 500"
                  placeholderTextColor={COLORS.textLight}
                  value={doseMg}
                  onChangeText={setDoseMg}
                  keyboardType="numeric"
                />
                <Text style={styles.unitText}>mg</Text>
              </View>
            </Card>
          </Animated.View>

          {/* ─── Frecuencia Card ─── */}
          <Animated.View entering={FadeInDown.duration(350).delay(160)}>
            <Card style={styles.sectionCard}>
              <View style={styles.cardHeader}>
                <IconBadge name="repeat" color={COLORS.accent} backgroundColor="#FFE4E8" />
                <Text style={styles.sectionLabel}>¿Con qué frecuencia?</Text>
              </View>
              <View style={styles.chipRow}>
                {FREQUENCY_OPTIONS.map((opt) => {
                  const isActive =
                    opt.value === 'custom'
                      ? frequencyHours === 'custom'
                      : frequencyHours === opt.value;
                  return (
                    <Chip
                      key={opt.value}
                      label={opt.label}
                      selected={isActive}
                      onPress={() => handleSelectFrequency(opt.value)}
                      compact
                    />
                  );
                })}
              </View>
              {frequencyHours === 'custom' && (
                <View style={styles.customInputRow}>
                  <View style={[styles.inputInner, { flex: 1 }]}>
                    <TextInput
                      style={styles.input}
                      placeholder="Ej: 3"
                      placeholderTextColor={COLORS.textLight}
                      value={customFrequency}
                      onChangeText={setCustomFrequency}
                      keyboardType="numeric"
                    />
                    <Text style={styles.unitText}>horas</Text>
                  </View>
                </View>
              )}
            </Card>
          </Animated.View>

          {/* ─── Hora de inicio Card ─── */}
          <Animated.View entering={FadeInDown.duration(350).delay(200)}>
            <Card style={styles.sectionCard}>
              <View style={styles.cardHeader}>
                <IconBadge name="time" color={COLORS.accent} backgroundColor="#FFE4E8" />
                <Text style={styles.sectionLabel}>¿A qué hora empieza?</Text>
              </View>
              <View style={styles.chipRow}>
                {TIME_OPTIONS.map((opt) => {
                  const presetValues = ['06:00', '08:00', '13:00', '20:00', '22:00'];
                  const isCustomTime = !presetValues.includes(startTime);
                  const isActive =
                    opt.value === 'custom' ? isCustomTime : startTime === opt.value;
                  return (
                    <Chip
                      key={opt.value}
                      emoji={opt.label}
                      label=""
                      subLabel={opt.value === 'custom' && isActive ? formatTime12h(startTime) : opt.sub}
                      selected={isActive}
                      onPress={() => handleSelectTime(opt.value)}
                    />
                  );
                })}
              </View>

              {/* Confirmación amigable de horario */}
              <View style={styles.periodConfirm}>
                <Text style={styles.periodConfirmText}>{getPeriodLabel(startTime)}</Text>
                <Text style={styles.periodConfirmTime}>Primera toma: {formatTime12h(startTime)}</Text>
              </View>
            </Card>
          </Animated.View>

          {/* ─── Días de la Semana Card ─── */}
          <Animated.View entering={FadeInDown.duration(350).delay(240)}>
            <Card style={styles.sectionCard}>
              <View style={styles.cardHeader}>
                <IconBadge name="calendar" color={COLORS.accent} backgroundColor="#FFE4E8" />
                <Text style={styles.sectionLabel}>¿Qué días?</Text>
                <TouchableOpacity onPress={selectAllDays} activeOpacity={0.7}>
                  <Text style={styles.selectAllText}>
                    {selectedDays.length === 7 ? 'Quitar todos' : 'Todos los días'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.daysRow}>
                {DAYS_OF_WEEK.map((day) => {
                  const isActive = selectedDays.includes(day.value);
                  return (
                    <Chip
                      key={day.value}
                      label={day.label}
                      subLabel={day.full}
                      selected={isActive}
                      onPress={() => toggleDay(day.value)}
                      style={styles.dayChip}
                    />
                  );
                })}
              </View>
            </Card>
          </Animated.View>

          {/* ─── Time Picker: nativo en Android/iOS, propio en web ─── */}
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

          {/* ─── Save Button ─── */}
          <Button
            title="Guardar Medicamento"
            icon="checkmark-circle"
            onPress={confirmAndSave}
            loading={saving}
            style={styles.saveButton}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 140,
  },
  // ─── Header ───
  title: {
    fontSize: FONTS.sizeXLarge,
    fontFamily: FONTS.family.bold,
    color: COLORS.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: FONTS.sizeMedium,
    fontFamily: FONTS.family.regular,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
  },
  // ─── Section Card ───
  sectionCard: {
    marginBottom: SPACING.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    gap: SPACING.sm + 4,
  },
  sectionLabel: {
    fontSize: FONTS.sizeSmall,
    fontFamily: FONTS.family.bold,
    color: COLORS.text,
    flex: 1,
  },
  // ─── Photo Card ───
  photoCard: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    marginBottom: SPACING.md,
  },
  photo: {
    width: 180,
    height: 180,
    borderRadius: 16,
  },
  photoPlaceholder: {
    alignItems: 'center',
    gap: SPACING.sm,
  },
  photoTitle: {
    fontSize: FONTS.sizeMedium,
    fontFamily: FONTS.family.bold,
    color: COLORS.primary,
  },
  photoHint: {
    fontSize: FONTS.sizeSmall,
    fontFamily: FONTS.family.regular,
    color: COLORS.textLight,
  },
  // ─── Input interior (capa gris dentro de tarjeta blanca) ───
  inputInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    minHeight: TOUCH_TARGET.minHeight,
  },
  input: {
    flex: 1,
    fontSize: FONTS.sizeMedium,
    fontFamily: FONTS.family.regular,
    color: COLORS.text,
    paddingVertical: SPACING.md,
  },
  unitText: {
    fontSize: FONTS.sizeMedium,
    fontFamily: FONTS.family.bold,
    color: COLORS.textSecondary,
  },
  // ─── Chips ───
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  customInputRow: {
    marginTop: SPACING.sm,
  },
  // ─── Days of Week ───
  daysRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    justifyContent: 'center',
  },
  dayChip: {
    minWidth: 58,
    minHeight: TOUCH_TARGET.minHeight,
  },
  selectAllText: {
    fontSize: FONTS.sizeSmall,
    fontFamily: FONTS.family.semiBold,
    color: COLORS.primary,
  },
  // ─── Save Button ───
  saveButton: {
    marginTop: SPACING.lg,
    minHeight: TOUCH_TARGET.minHeight + 4,
    borderRadius: 16,
  },
  // ─── Period confirmation ───
  periodConfirm: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.primaryBg,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
  },
  periodConfirmText: {
    fontSize: FONTS.sizeMedium,
    fontFamily: FONTS.family.semiBold,
    color: COLORS.primary,
  },
  periodConfirmTime: {
    fontSize: FONTS.sizeSmall,
    fontFamily: FONTS.family.regular,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
});
