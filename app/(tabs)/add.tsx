import { useAuth } from '@/context/AuthContext';
import { computeDoseDates, scheduleMedicationNotifications } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { COLORS, FONTS, SPACING, TOUCH_TARGET } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
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

// ─── Sombra reutilizable para tarjetas ───
const CARD_SHADOW = {
  shadowColor: COLORS.cardShadow,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.05,
  shadowRadius: 8,
  elevation: 3,
};

export default function AddMedicationScreen() {
  const { user } = useAuth();
  const router = useRouter();
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

  const pickImage = async (fromCamera: boolean) => {
    let result: ImagePicker.ImagePickerResult;

    if (fromCamera) {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permiso necesario', 'Necesitamos acceso a la cámara para tomar fotos.');
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
        Alert.alert('Permiso necesario', 'Necesitamos acceso a tu galería.');
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
    Alert.alert('Seleccionar foto', '¿De dónde quieres obtener la foto?', [
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
      const fileName = `${user!.id}/${Date.now()}.jpg`;
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

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Ingresa el nombre del medicamento');
      return;
    }
    if (!doseMg || isNaN(Number(doseMg)) || Number(doseMg) <= 0) {
      Alert.alert('Error', 'Ingresa una dosis válida en mg');
      return;
    }
    const finalFrequency = frequencyHours === 'custom' ? customFrequency : frequencyHours;
    if (!finalFrequency || isNaN(Number(finalFrequency)) || Number(finalFrequency) <= 0) {
      Alert.alert('Error', 'Selecciona cada cuántas horas');
      return;
    }
    if (selectedDays.length === 0) {
      Alert.alert('Error', 'Selecciona al menos un día de la semana');
      return;
    }

    setSaving(true);

    let photoUrl: string | null = null;
    if (imageUri) {
      photoUrl = await uploadImage(imageUri);
    }

    const { data, error } = await supabase
      .from('medications')
      .insert({
        user_id: user!.id,
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
      Alert.alert('Error', 'No se pudo guardar el medicamento. Intenta de nuevo.');
      console.error('Insert error:', error);
      setSaving(false);
      return;
    }

    if (data) {
      // Programar notificaciones y guardar IDs en la tabla medications
      const notifIds = await scheduleMedicationNotifications(data);
      if (notifIds.length > 0) {
        await supabase
          .from('medications')
          .update({ notification_ids: notifIds })
          .eq('id', data.id);
      }
      const doseDates = computeDoseDates(data);

      // Insertar primer registro de dosis con scheduled_at = primera toma real
      if (doseDates.length > 0) {
        await supabase.from('dose_records').insert({
          medication_id: data.id,
          user_id: user!.id,
          scheduled_at: doseDates[0].toISOString(),
          taken: null, // pendiente
          responded_at: null,
        });
      }
    }

    setSaving(false);
    Alert.alert('Listo', `"${name.trim()}" se agregó correctamente.`, [
      { text: 'OK', onPress: () => router.push('/(tabs)') },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
          <Text style={styles.title}>Agregar Medicamento</Text>
          <Text style={styles.subtitle}>Completa los datos de tu medicina</Text>

          {/* ─── Photo Card ─── */}
          <TouchableOpacity
            style={[styles.sectionCard, styles.photoCard]}
            onPress={showImageOptions}
            activeOpacity={0.7}
          >
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.photo} contentFit="cover" />
            ) : (
              <View style={styles.photoPlaceholder}>
                <View style={styles.cameraCircle}>
                  <Ionicons name="camera" size={40} color={COLORS.primary} />
                </View>
                <Text style={styles.photoTitle}>Agregar foto</Text>
                <Text style={styles.photoHint}>Toca para tomar o elegir una foto</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* ─── Nombre Card ─── */}
          <View style={styles.sectionCard}>
            <View style={styles.cardHeader}>
              <View style={styles.iconCircle}>
                <Ionicons name="medical" size={22} color={COLORS.accent} />
              </View>
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
          </View>

          {/* ─── Dosis Card ─── */}
          <View style={styles.sectionCard}>
            <View style={styles.cardHeader}>
              <View style={styles.iconCircle}>
                <Ionicons name="fitness" size={22} color={COLORS.accent} />
              </View>
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
          </View>

          {/* ─── Frecuencia Card ─── */}
          <View style={styles.sectionCard}>
            <View style={styles.cardHeader}>
              <View style={styles.iconCircle}>
                <Ionicons name="repeat" size={22} color={COLORS.accent} />
              </View>
              <Text style={styles.sectionLabel}>¿Con qué frecuencia?</Text>
            </View>
            <View style={styles.freqRow}>
              {FREQUENCY_OPTIONS.map((opt) => {
                const isActive =
                  opt.value === 'custom'
                    ? frequencyHours === 'custom'
                    : frequencyHours === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.freqChip, isActive && styles.freqChipActive]}
                    onPress={() => handleSelectFrequency(opt.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.freqChipText, isActive && styles.freqChipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
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
          </View>

          {/* ─── Hora de inicio Card ─── */}
          <View style={styles.sectionCard}>
            <View style={styles.cardHeader}>
              <View style={styles.iconCircle}>
                <Ionicons name="time" size={22} color={COLORS.accent} />
              </View>
              <Text style={styles.sectionLabel}>¿A qué hora empieza?</Text>
            </View>
            <View style={styles.timeRow}>
              {TIME_OPTIONS.map((opt) => {
                const presetValues = ['06:00', '08:00', '13:00', '20:00', '22:00'];
                const isCustomTime = !presetValues.includes(startTime);
                const isActive =
                  opt.value === 'custom' ? isCustomTime : startTime === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.timeChip, isActive && styles.timeChipActive]}
                    onPress={() => handleSelectTime(opt.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.timeChipEmoji}>{opt.label}</Text>
                    <Text style={[styles.timeChipSub, isActive && styles.timeChipSubActive]}>
                      {opt.value === 'custom' && isActive ? formatTime12h(startTime) : opt.sub}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Confirmación amigable de horario */}
            <View style={styles.periodConfirm}>
              <Text style={styles.periodConfirmText}>{getPeriodLabel(startTime)}</Text>
              <Text style={styles.periodConfirmTime}>Primera toma: {formatTime12h(startTime)}</Text>
            </View>
          </View>

          {/* ─── Días de la Semana Card ─── */}
          <View style={styles.sectionCard}>
            <View style={styles.cardHeader}>
              <View style={styles.iconCircle}>
                <Ionicons name="calendar" size={22} color={COLORS.accent} />
              </View>
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
                  <TouchableOpacity
                    key={day.value}
                    style={[styles.dayChip, isActive && styles.dayChipActive]}
                    onPress={() => toggleDay(day.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dayChipText, isActive && styles.dayChipTextActive]}>
                      {day.label}
                    </Text>
                    <Text style={[styles.dayChipFull, isActive && styles.dayChipFullActive]}>
                      {day.full}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ─── Native Time Picker (Android/iOS) ─── */}
          {showTimePicker && (
            <DateTimePicker
              value={tempTime}
              mode="time"
              is24Hour={false}
              display="default"
              onChange={onTimePickerChange}
            />
          )}

          {/* ─── Save Button ─── */}
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.7}
          >
            {saving ? (
              <ActivityIndicator color={COLORS.white} size="large" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={28} color={COLORS.white} />
                <Text style={styles.saveButtonText}>Guardar Medicamento</Text>
              </>
            )}
          </TouchableOpacity>
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
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: FONTS.sizeMedium,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
  },
  // ─── Section Card (tarjeta blanca con sombra) ───
  sectionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...CARD_SHADOW,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    gap: SPACING.sm + 4,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionLabel: {
    fontSize: FONTS.sizeSmall,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
  },
  // ─── Photo Card ───
  photoCard: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  photo: {
    width: 180,
    height: 180,
    borderRadius: 16,
  },
  photoPlaceholder: {
    alignItems: 'center',
  },
  cameraCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primaryBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  photoTitle: {
    fontSize: FONTS.sizeMedium,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  photoHint: {
    fontSize: FONTS.sizeSmall,
    color: COLORS.textLight,
    marginTop: 4,
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
    color: COLORS.text,
    paddingVertical: SPACING.md,
  },
  unitText: {
    fontSize: FONTS.sizeMedium,
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  // ─── Frequency chips ───
  freqRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  freqChip: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingHorizontal: SPACING.md + 4,
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    ...CARD_SHADOW,
  },
  freqChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  freqChipText: {
    fontSize: FONTS.sizeMedium,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  freqChipTextActive: {
    color: COLORS.white,
    fontWeight: 'bold',
  },
  // ─── Time chips ───
  timeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  timeChip: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 4,
    minHeight: 64,
    minWidth: 72,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    ...CARD_SHADOW,
  },
  timeChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  timeChipEmoji: {
    fontSize: FONTS.sizeSmall,
    textAlign: 'center',
  },
  timeChipSub: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  timeChipSubActive: {
    color: COLORS.white,
  },
  // ─── Custom frequency input ───
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
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.sm + 2,
    minWidth: 58,
    minHeight: 64,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    ...CARD_SHADOW,
  },
  dayChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  dayChipText: {
    fontSize: FONTS.sizeMedium,
    fontWeight: 'bold',
    color: COLORS.textSecondary,
  },
  dayChipTextActive: {
    color: COLORS.white,
  },
  dayChipFull: {
    fontSize: 11,
    color: COLORS.textLight,
    marginTop: 2,
  },
  dayChipFullActive: {
    color: COLORS.white,
  },
  selectAllText: {
    fontSize: FONTS.sizeSmall,
    fontWeight: '600',
    color: COLORS.primary,
  },
  // ─── Save Button ───
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    minHeight: TOUCH_TARGET.minHeight + 4,
    marginTop: SPACING.lg,
    gap: SPACING.sm,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: COLORS.white,
    fontSize: FONTS.sizeLarge,
    fontWeight: 'bold',
  },
  // ─── Period confirmation ───
  periodConfirm: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.primaryBg,
    borderRadius: 12,
    padding: SPACING.md,
    alignItems: 'center',
  },
  periodConfirmText: {
    fontSize: FONTS.sizeMedium,
    fontWeight: '600',
    color: COLORS.primary,
  },
  periodConfirmTime: {
    fontSize: FONTS.sizeSmall,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
});
