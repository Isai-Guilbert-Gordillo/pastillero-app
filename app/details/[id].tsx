import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAppAlert } from '@/components/AppAlert';
import PatientBanner from '@/components/PatientBanner';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import IconBadge from '@/components/ui/IconBadge';
import { useCaregiver } from '@/context/CaregiverContext';
import { supabase } from '@/lib/supabase';
import { cancelAllMedicationNotifications, scheduleMedicationNotifications, scheduleNativeAlarms } from '@/lib/notifications';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, TOUCH_TARGET, SHADOWS } from '@/lib/theme';
import { Medication } from '@/lib/types';

// ─── Opciones reutilizadas del formulario add.tsx ───
const FREQUENCY_OPTIONS = [
  { label: 'Cada 4h', value: '4' },
  { label: 'Cada 6h', value: '6' },
  { label: 'Cada 8h', value: '8' },
  { label: 'Cada 12h', value: '12' },
  { label: 'Cada 24h', value: '24' },
];

const TIME_OPTIONS = [
  { label: '🌅 6:00', sub: 'Desayuno', value: '06:00' },
  { label: '☀️ 8:00', sub: 'Mañana', value: '08:00' },
  { label: '🍽️ 13:00', sub: 'Comida', value: '13:00' },
  { label: '🌙 20:00', sub: 'Cena', value: '20:00' },
  { label: '😴 22:00', sub: 'Noche', value: '22:00' },
];

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

export default function MedicationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isViewingOther, activePatientLabel } = useCaregiver();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { alert } = useAppAlert();

  const [medication, setMedication] = useState<Medication | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // ─── Edit form state ───
  const [editName, setEditName] = useState('');
  const [editDoseMg, setEditDoseMg] = useState('');
  const [editFrequency, setEditFrequency] = useState('8');
  const [editStartTime, setEditStartTime] = useState('08:00');
  const [editImageUri, setEditImageUri] = useState<string | null>(null);
  const [editSelectedDays, setEditSelectedDays] = useState<string[]>(ALL_DAYS);

  const fetchMedication = async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from('medications')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      alert('Error', 'No se encontró el medicamento.');
      router.back();
      return;
    }
    setMedication(data);
    // Pre-fill edit fields
    setEditName(data.name);
    setEditDoseMg(String(data.dose_mg));
    setEditFrequency(String(data.frequency_hours));
    setEditStartTime(data.start_time);
    setEditImageUri(data.photo_url);
    setEditSelectedDays(data.days_of_week?.length ? data.days_of_week : ALL_DAYS);
    setLoading(false);
  };

  const toggleEditDay = (day: string) => {
    setEditSelectedDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const selectAllEditDays = () => {
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

  // ─── Delete (soft delete: active = false) ───
  const handleDelete = () => {
    alert(
      'Eliminar medicamento',
      '¿Estás seguro de que quieres eliminar este recordatorio?',
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
              alert('Error', 'No se pudo eliminar el medicamento.');
              return;
            }
            router.back();
          },
        },
      ]
    );
  };

  // ─── Image picker ───
  const pickImage = async (fromCamera: boolean) => {
    let result: ImagePicker.ImagePickerResult;
    if (fromCamera) {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        alert('Permiso necesario', 'Necesitamos acceso a la cámara.');
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
      setEditImageUri(result.assets[0].uri);
    }
  };

  const showImageOptions = () => {
    alert('Seleccionar foto', '¿De dónde quieres obtener la foto?', [
      { text: 'Cámara', onPress: () => pickImage(true) },
      { text: 'Galería', onPress: () => pickImage(false) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const uploadImage = async (uri: string): Promise<string | null> => {
    try {
      const fileName = `${medication!.user_id}/${Date.now()}.jpg`;
      const response = await fetch(uri);
      const blob = await response.blob();
      const arrayBuffer = await new Response(blob).arrayBuffer();

      const { error } = await supabase.storage
        .from('medication-photos')
        .upload(fileName, arrayBuffer, { contentType: 'image/jpeg', upsert: false });

      if (error) return null;

      const { data } = supabase.storage
        .from('medication-photos')
        .getPublicUrl(fileName);
      return data.publicUrl;
    } catch {
      return null;
    }
  };

  // ─── Save edits ───
  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      alert('Error', 'Ingresa el nombre del medicamento');
      return;
    }
    if (!editDoseMg || isNaN(Number(editDoseMg)) || Number(editDoseMg) <= 0) {
      alert('Error', 'Ingresa una dosis válida en mg');
      return;
    }
    if (editSelectedDays.length === 0) {
      alert('Error', 'Selecciona al menos un día de la semana');
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

    let photoUrl = medication?.photo_url ?? null;
    // Upload new image only if it changed and is a local URI
    if (editImageUri && editImageUri !== medication?.photo_url) {
      const uploaded = await uploadImage(editImageUri);
      if (uploaded) photoUrl = uploaded;
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
      })
      .eq('id', medication!.id)
      .select()
      .single();

    if (error) {
      alert('Error', 'No se pudo actualizar el medicamento.');
      setSaving(false);
      return;
    }

    // Reschedule notifications — pero solo en el teléfono de la propia persona.
    // Las alarmas son locales al dispositivo; si esto se guarda desde el modo
    // cuidador, reprogramarlas aquí sonaría en el teléfono del cuidador, no en
    // el del paciente, así que en ese caso solo avisamos.
    if (data) {
      if (!isViewingOther) {
        await cancelAllMedicationNotifications(data.id);
        await scheduleMedicationNotifications(data);
        if (scheduleChanged) {
          const alarmResult = await scheduleNativeAlarms(data);
          if (alarmResult.attempted > 0 && alarmResult.succeeded === 0) {
            alert(
              'No se pudo crear la alarma',
              `El horario se guardó, pero no se pudo crear la alarma en el Reloj de tu teléfono.\n\nDetalle: ${alarmResult.errors[0] ?? 'error desconocido'}`
            );
          } else if (alarmResult.succeeded > 0) {
            alert(
              '⏰ Horario cambiado',
              'Se creó una alarma nueva en el Reloj de tu teléfono. Si quieres, borra ahí la alarma anterior para que no queden dos.'
            );
          }
        }
      } else if (scheduleChanged) {
        alert(
          '✅ Guardado, pero falta un paso',
          `El horario se actualizó en la cuenta de ${activePatientLabel}, pero la alarma NO va a sonar hasta que esa persona abra PastilleroApp en su propio teléfono.`
        );
      }
      setMedication(data);
    }

    setSaving(false);
    setEditing(false);
  };

  // ─── Loading state ───
  if (loading || !medication) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════
  // ─── EDIT MODE ───
  // ═══════════════════════════════════════════
  if (editing) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <PatientBanner />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          {/* Edit Header */}
          <View style={styles.editHeader}>
            <TouchableOpacity
              onPress={() => {
                // Reset fields and exit edit mode
                setEditName(medication.name);
                setEditDoseMg(String(medication.dose_mg));
                setEditFrequency(String(medication.frequency_hours));
                setEditStartTime(medication.start_time);
                setEditImageUri(medication.photo_url);
                setEditSelectedDays(medication.days_of_week?.length ? medication.days_of_week : ALL_DAYS);
                setEditing(false);
              }}
              style={styles.editHeaderBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={26} color={COLORS.textSecondary} />
              <Text style={styles.editHeaderBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={styles.editHeaderTitle}>Editar</Text>
            <View style={{ width: 90 }} />
          </View>

          <ScrollView
            contentContainerStyle={styles.editScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Photo */}
            <TouchableOpacity onPress={showImageOptions} activeOpacity={0.7}>
              <Card style={styles.photoCardEdit}>
                {editImageUri ? (
                  <Image source={{ uri: editImageUri }} style={styles.photoEdit} contentFit="cover" />
                ) : (
                  <View style={styles.photoPlaceholderEdit}>
                    <IconBadge name="camera" color={COLORS.primary} backgroundColor={COLORS.primaryBg} size={72} iconSize={34} />
                    <Text style={styles.photoHintEdit}>Cambiar foto</Text>
                  </View>
                )}
              </Card>
            </TouchableOpacity>

            {/* Name */}
            <Card style={styles.sectionCard}>
              <View style={styles.cardHeader}>
                <IconBadge name="medical" color={COLORS.accent} backgroundColor="#FFE4E8" />
                <Text style={styles.sectionLabel}>Nombre del medicamento</Text>
              </View>
              <View style={styles.inputInner}>
                <TextInput
                  style={styles.input}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Nombre"
                  placeholderTextColor={COLORS.textLight}
                  autoCapitalize="words"
                />
              </View>
            </Card>

            {/* Dose */}
            <Card style={styles.sectionCard}>
              <View style={styles.cardHeader}>
                <IconBadge name="fitness" color={COLORS.accent} backgroundColor="#FFE4E8" />
                <Text style={styles.sectionLabel}>Dosis</Text>
              </View>
              <View style={styles.inputInner}>
                <TextInput
                  style={styles.input}
                  value={editDoseMg}
                  onChangeText={setEditDoseMg}
                  placeholder="500"
                  placeholderTextColor={COLORS.textLight}
                  keyboardType="numeric"
                />
                <Text style={styles.unitText}>mg</Text>
              </View>
            </Card>

            {/* Frequency */}
            <Card style={styles.sectionCard}>
              <View style={styles.cardHeader}>
                <IconBadge name="repeat" color={COLORS.accent} backgroundColor="#FFE4E8" />
                <Text style={styles.sectionLabel}>¿Con qué frecuencia?</Text>
              </View>
              <View style={styles.chipRow}>
                {FREQUENCY_OPTIONS.map((opt) => (
                  <Chip
                    key={opt.value}
                    label={opt.label}
                    selected={editFrequency === opt.value}
                    onPress={() => setEditFrequency(opt.value)}
                    compact
                  />
                ))}
              </View>
            </Card>

            {/* Start Time */}
            <Card style={styles.sectionCard}>
              <View style={styles.cardHeader}>
                <IconBadge name="time" color={COLORS.accent} backgroundColor="#FFE4E8" />
                <Text style={styles.sectionLabel}>¿A qué hora empieza?</Text>
              </View>
              <View style={styles.chipRow}>
                {TIME_OPTIONS.map((opt) => (
                  <Chip
                    key={opt.value}
                    emoji={opt.label}
                    label=""
                    subLabel={opt.sub}
                    selected={editStartTime === opt.value}
                    onPress={() => setEditStartTime(opt.value)}
                  />
                ))}
              </View>
            </Card>

            {/* Days of Week */}
            <Card style={styles.sectionCard}>
              <View style={styles.cardHeader}>
                <IconBadge name="calendar" color={COLORS.accent} backgroundColor="#FFE4E8" />
                <Text style={styles.sectionLabel}>¿Qué días?</Text>
                <TouchableOpacity onPress={selectAllEditDays} activeOpacity={0.7}>
                  <Text style={styles.selectAllText}>
                    {editSelectedDays.length === 7 ? 'Quitar todos' : 'Todos los días'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.daysRow}>
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
            </Card>

            {/* Save Edit Button */}
            <Button
              title="Guardar Cambios"
              icon="checkmark-circle"
              onPress={handleSaveEdit}
              loading={saving}
              style={styles.saveBtn}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════
  // ─── DETAIL VIEW (read-only) ───
  // ═══════════════════════════════════════════
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <PatientBanner />
      <ScrollView
        contentContainerStyle={[styles.detailScroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Top Bar ─── */}
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="chevron-back" size={28} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Detalle</Text>
          <TouchableOpacity
            onPress={() => setEditing(true)}
            style={styles.editBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="create-outline" size={22} color={COLORS.primary} />
            <Text style={styles.editBtnText}>Editar</Text>
          </TouchableOpacity>
        </View>

        {/* ─── Photo / Icon Hero ─── */}
        <Animated.View entering={FadeInDown.duration(350)}>
          <Card style={styles.heroCard}>
            {medication.photo_url ? (
              <Image source={{ uri: medication.photo_url }} style={styles.heroImage} contentFit="cover" />
            ) : (
              <View style={styles.heroIconCircle}>
                <Text style={styles.heroEmoji}>💊</Text>
              </View>
            )}
            <Text style={styles.heroName}>{medication.name}</Text>
            <Text style={styles.heroDose}>{medication.dose_mg} mg</Text>
          </Card>
        </Animated.View>

        {/* ─── Info Cards ─── */}
        <Animated.View entering={FadeInDown.duration(350).delay(60)}>
          <Card style={styles.sectionCard}>
            <View style={styles.infoRow}>
              <IconBadge name="repeat" color={COLORS.primary} backgroundColor={COLORS.primaryBg} size={44} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Frecuencia</Text>
                <Text style={styles.infoValue}>Cada {medication.frequency_hours} horas</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <IconBadge name="time" color={COLORS.secondary} backgroundColor={COLORS.secondaryLight} size={44} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Hora de inicio</Text>
                <Text style={styles.infoValue}>{medication.start_time}</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <IconBadge name="alarm" color={COLORS.warning} backgroundColor={COLORS.warningLight} size={44} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Próxima toma</Text>
                <Text style={[styles.infoValue, { color: COLORS.warning }]}>
                  {getNextDoseTime(medication)}
                </Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <IconBadge name="calendar" color={COLORS.textSecondary} backgroundColor={COLORS.inputBg} size={44} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Agregado</Text>
                <Text style={styles.infoValue}>
                  {new Date(medication.created_at).toLocaleDateString('es-MX', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Text>
              </View>
            </View>
          </Card>
        </Animated.View>

        {/* ─── Delete Button (texto rojo discreto) ─── */}
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={handleDelete}
          activeOpacity={0.6}
        >
          <Ionicons name="trash-outline" size={22} color={COLORS.danger} />
          <Text style={styles.deleteBtnText}>Eliminar Medicamento</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // ═══ DETAIL VIEW ═══
  detailScroll: {
    padding: 20,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.card,
  },
  topBarTitle: {
    fontSize: FONTS.sizeLarge,
    fontFamily: FONTS.family.bold,
    color: COLORS.text,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  editBtnText: {
    fontSize: FONTS.sizeSmall,
    fontFamily: FONTS.family.bold,
    color: COLORS.primary,
  },
  // ─── Hero Card ───
  sectionCard: {
    marginBottom: SPACING.md,
  },
  heroCard: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    marginBottom: SPACING.md,
  },
  heroImage: {
    width: 120,
    height: 120,
    borderRadius: 16,
    marginBottom: SPACING.md,
  },
  heroIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primaryBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  heroEmoji: {
    fontSize: 48,
  },
  heroName: {
    fontSize: FONTS.sizeXLarge,
    fontFamily: FONTS.family.bold,
    color: COLORS.text,
    textAlign: 'center',
  },
  heroDose: {
    fontSize: FONTS.sizeLarge,
    fontFamily: FONTS.family.medium,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  // ─── Info Rows ───
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm + 4,
    gap: SPACING.md,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 16,
    fontFamily: FONTS.family.regular,
    color: COLORS.textLight,
  },
  infoValue: {
    fontSize: FONTS.sizeMedium,
    fontFamily: FONTS.family.semiBold,
    color: COLORS.text,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 4,
  },
  // ─── Delete Button (texto rojo discreto) ───
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    marginTop: SPACING.md,
  },
  deleteBtnText: {
    fontSize: FONTS.sizeMedium,
    fontFamily: FONTS.family.semiBold,
    color: COLORS.danger,
  },
  // ═══ EDIT MODE ═══
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  editHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 90,
  },
  editHeaderBtnText: {
    fontSize: FONTS.sizeSmall,
    fontFamily: FONTS.family.semiBold,
    color: COLORS.textSecondary,
  },
  editHeaderTitle: {
    fontSize: FONTS.sizeLarge,
    fontFamily: FONTS.family.bold,
    color: COLORS.text,
  },
  editScroll: {
    padding: 20,
    paddingBottom: 140,
  },
  // ─── Photo edit ───
  photoCardEdit: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    marginBottom: SPACING.md,
  },
  photoEdit: {
    width: 140,
    height: 140,
    borderRadius: 16,
  },
  photoPlaceholderEdit: {
    alignItems: 'center',
    gap: 8,
  },
  photoHintEdit: {
    fontSize: FONTS.sizeSmall,
    fontFamily: FONTS.family.semiBold,
    color: COLORS.primary,
  },
  // ─── Card internals (shared with add.tsx design) ───
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
  saveBtn: {
    marginTop: SPACING.lg,
    minHeight: TOUCH_TARGET.minHeight + 4,
    borderRadius: 16,
  },
});
