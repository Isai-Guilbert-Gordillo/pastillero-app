import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
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
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { cancelAllMedicationNotifications, scheduleMedicationNotifications } from '@/lib/notifications';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, TOUCH_TARGET } from '@/lib/theme';
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

const CARD_SHADOW = {
  shadowColor: COLORS.cardShadow,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.05,
  shadowRadius: 8,
  elevation: 3,
};

export default function MedicationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

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

  const fetchMedication = async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from('medications')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      Alert.alert('Error', 'No se encontró el medicamento.');
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
    setLoading(false);
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
    Alert.alert(
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
              Alert.alert('Error', 'No se pudo eliminar el medicamento.');
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
        Alert.alert('Permiso necesario', 'Necesitamos acceso a la cámara.');
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
      setEditImageUri(result.assets[0].uri);
    }
  };

  const showImageOptions = () => {
    Alert.alert('Seleccionar foto', '¿De dónde quieres obtener la foto?', [
      { text: 'Cámara', onPress: () => pickImage(true) },
      { text: 'Galería', onPress: () => pickImage(false) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const uploadImage = async (uri: string): Promise<string | null> => {
    try {
      const fileName = `${user!.id}/${Date.now()}.jpg`;
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
      Alert.alert('Error', 'Ingresa el nombre del medicamento');
      return;
    }
    if (!editDoseMg || isNaN(Number(editDoseMg)) || Number(editDoseMg) <= 0) {
      Alert.alert('Error', 'Ingresa una dosis válida en mg');
      return;
    }

    setSaving(true);

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
        photo_url: photoUrl,
      })
      .eq('id', medication!.id)
      .select()
      .single();

    if (error) {
      Alert.alert('Error', 'No se pudo actualizar el medicamento.');
      setSaving(false);
      return;
    }

    // Reschedule notifications
    if (data) {
      await cancelAllMedicationNotifications(data.id);
      await scheduleMedicationNotifications(data);
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
            <TouchableOpacity
              style={[styles.sectionCard, styles.photoCardEdit]}
              onPress={showImageOptions}
              activeOpacity={0.7}
            >
              {editImageUri ? (
                <Image source={{ uri: editImageUri }} style={styles.photoEdit} contentFit="cover" />
              ) : (
                <View style={styles.photoPlaceholderEdit}>
                  <Ionicons name="camera" size={36} color={COLORS.primary} />
                  <Text style={styles.photoHintEdit}>Cambiar foto</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Name */}
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
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Nombre"
                  placeholderTextColor={COLORS.textLight}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Dose */}
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
                  value={editDoseMg}
                  onChangeText={setEditDoseMg}
                  placeholder="500"
                  placeholderTextColor={COLORS.textLight}
                  keyboardType="numeric"
                />
                <Text style={styles.unitText}>mg</Text>
              </View>
            </View>

            {/* Frequency */}
            <View style={styles.sectionCard}>
              <View style={styles.cardHeader}>
                <View style={styles.iconCircle}>
                  <Ionicons name="repeat" size={22} color={COLORS.accent} />
                </View>
                <Text style={styles.sectionLabel}>¿Con qué frecuencia?</Text>
              </View>
              <View style={styles.chipRow}>
                {FREQUENCY_OPTIONS.map((opt) => {
                  const isActive = editFrequency === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.chip, isActive && styles.chipActive]}
                      onPress={() => setEditFrequency(opt.value)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Start Time */}
            <View style={styles.sectionCard}>
              <View style={styles.cardHeader}>
                <View style={styles.iconCircle}>
                  <Ionicons name="time" size={22} color={COLORS.accent} />
                </View>
                <Text style={styles.sectionLabel}>¿A qué hora empieza?</Text>
              </View>
              <View style={styles.chipRow}>
                {TIME_OPTIONS.map((opt) => {
                  const isActive = editStartTime === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.timeChip, isActive && styles.chipActive]}
                      onPress={() => setEditStartTime(opt.value)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.timeChipEmoji}>{opt.label}</Text>
                      <Text style={[styles.timeChipSub, isActive && styles.timeChipSubActive]}>
                        {opt.sub}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Save Edit Button */}
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.7 }]}
              onPress={handleSaveEdit}
              disabled={saving}
              activeOpacity={0.7}
            >
              {saving ? (
                <ActivityIndicator color={COLORS.white} size="large" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={28} color={COLORS.white} />
                  <Text style={styles.saveBtnText}>Guardar Cambios</Text>
                </>
              )}
            </TouchableOpacity>
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
        <View style={[styles.sectionCard, styles.heroCard]}>
          {medication.photo_url ? (
            <Image source={{ uri: medication.photo_url }} style={styles.heroImage} contentFit="cover" />
          ) : (
            <View style={styles.heroIconCircle}>
              <Text style={styles.heroEmoji}>💊</Text>
            </View>
          )}
          <Text style={styles.heroName}>{medication.name}</Text>
          <Text style={styles.heroDose}>{medication.dose_mg} mg</Text>
        </View>

        {/* ─── Info Cards ─── */}
        <View style={styles.sectionCard}>
          <View style={styles.infoRow}>
            <View style={styles.infoIconCircle}>
              <Ionicons name="repeat" size={22} color={COLORS.primary} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Frecuencia</Text>
              <Text style={styles.infoValue}>Cada {medication.frequency_hours} horas</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <View style={styles.infoIconCircle}>
              <Ionicons name="time" size={22} color={COLORS.primary} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Hora de inicio</Text>
              <Text style={styles.infoValue}>{medication.start_time}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <View style={styles.infoIconCircle}>
              <Ionicons name="alarm" size={22} color={COLORS.warning} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Próxima toma</Text>
              <Text style={[styles.infoValue, { color: COLORS.warning, fontWeight: 'bold' }]}>
                {getNextDoseTime(medication)}
              </Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <View style={styles.infoIconCircle}>
              <Ionicons name="calendar" size={22} color={COLORS.textSecondary} />
            </View>
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
        </View>

        {/* ─── Delete Button (texto rojo discreto) ─── */}
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={handleDelete}
          activeOpacity={0.6}
        >
          <Ionicons name="trash-outline" size={22} color="#D32F2F" />
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
    ...CARD_SHADOW,
  },
  topBarTitle: {
    fontSize: FONTS.sizeLarge,
    fontWeight: 'bold',
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
    fontWeight: '700',
    color: COLORS.primary,
  },
  // ─── Hero Card ───
  sectionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...CARD_SHADOW,
  },
  heroCard: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
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
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
  },
  heroDose: {
    fontSize: FONTS.sizeLarge,
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
  infoIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primaryBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 16,
    color: COLORS.textLight,
  },
  infoValue: {
    fontSize: FONTS.sizeMedium,
    color: COLORS.text,
    fontWeight: '600',
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
    color: '#D32F2F',
    fontWeight: '600',
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
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  editHeaderTitle: {
    fontSize: FONTS.sizeLarge,
    fontWeight: 'bold',
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
    color: COLORS.primary,
    fontWeight: '600',
  },
  // ─── Card internals (shared with add.tsx design) ───
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
  // ─── Chips ───
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  chip: {
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
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: FONTS.sizeMedium,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  chipTextActive: {
    color: COLORS.white,
    fontWeight: 'bold',
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
  // ─── Save Button ───
  saveBtn: {
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
  saveBtnText: {
    color: COLORS.white,
    fontSize: FONTS.sizeLarge,
    fontWeight: 'bold',
  },
});
