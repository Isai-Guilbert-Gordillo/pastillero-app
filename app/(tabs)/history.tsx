import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAppAlert } from '@/components/AppAlert';
import PatientBanner from '@/components/PatientBanner';
import Card from '@/components/ui/Card';
import ScreenHeader from '@/components/ui/ScreenHeader';
import { useCaregiver } from '@/context/CaregiverContext';
import { reconcileDoseRecords } from '@/lib/doseSync';
import { supabase } from '@/lib/supabase';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, TOUCH_TARGET } from '@/lib/theme';
import { DoseRecord } from '@/lib/types';

interface DoseWithMedName extends DoseRecord {
  medication_name?: string;
}

type FilterKey = 'all' | 'pending' | 'taken' | 'skipped';

const FILTERS: { key: FilterKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'all', label: 'Todos', icon: 'apps' },
  { key: 'pending', label: 'Pendientes', icon: 'help-circle' },
  { key: 'taken', label: 'Tomadas', icon: 'thumbs-up' },
  { key: 'skipped', label: 'No tomadas', icon: 'close-circle' },
];

export default function HistoryScreen() {
  const { activePatientId } = useCaregiver();
  const { alert } = useAppAlert();
  const [records, setRecords] = useState<DoseWithMedName[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('all');

  const filteredRecords = records.filter((r) => {
    if (filter === 'pending') return r.taken === null;
    if (filter === 'taken') return r.taken === true;
    if (filter === 'skipped') return r.taken === false;
    return true;
  });

  const fetchRecords = async () => {
    if (!activePatientId) return;

    const { data, error } = await supabase
      .from('dose_records')
      .select('*, medications(name)')
      .eq('user_id', activePatientId)
      .order('scheduled_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching records:', error);
    } else {
      const mapped = (data ?? []).map((r: any) => ({
        ...r,
        medication_name: r.medications?.name ?? 'Medicamento',
      }));
      setRecords(mapped);
    }
    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      if (activePatientId) {
        reconcileDoseRecords(activePatientId)
          .catch((e) => console.log('Error reconciliando dosis:', e))
          .finally(fetchRecords);
      }
    }, [activePatientId])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRecords();
    setRefreshing(false);
  };

  const handleMarkDose = async (record: DoseWithMedName, taken: boolean) => {
    const { error } = await supabase
      .from('dose_records')
      .update({
        taken,
        responded_at: new Date().toISOString(),
      })
      .eq('id', record.id);

    if (error) {
      alert('Error', 'No se pudo actualizar el registro.');
      console.error('Update error:', error);
    } else {
      fetchRecords();
    }
  };

  // Permite corregir un registro que ya se marcó por error (ej. un toque
  // accidental en "Ya la tomé"), sin tener que dejarlo mal para siempre.
  const handleCorrectDose = (record: DoseWithMedName) => {
    const buttons = [];
    if (record.taken !== true) {
      buttons.push({ text: 'Marcar como tomada', onPress: () => handleMarkDose(record, true) });
    }
    if (record.taken !== false) {
      buttons.push({ text: 'Marcar como no tomada', onPress: () => handleMarkDose(record, false) });
    }
    buttons.push({ text: 'Cancelar', style: 'cancel' as const });
    alert(
      'Corregir registro',
      `${record.medication_name} — ${formatDateTime(record.scheduled_at)}`,
      buttons
    );
  };

  const formatDateTime = (isoString: string): string => {
    const date = new Date(isoString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day}/${month} a las ${hours}:${minutes}`;
  };

  const getStatusInfo = (record: DoseWithMedName) => {
    if (record.taken === true) {
      return {
        icon: 'thumbs-up' as const,
        color: COLORS.success,
        bgColor: COLORS.successLight,
        text: 'Tomado',
      };
    }
    if (record.taken === false) {
      return {
        icon: 'ellipse' as const,
        color: COLORS.danger,
        bgColor: COLORS.dangerLight,
        text: 'No tomado',
      };
    }
    return {
      icon: 'help-circle' as const,
      color: COLORS.warning,
      bgColor: COLORS.warningLight,
      text: 'Pendiente',
    };
  };

  const renderRecord = ({ item, index }: { item: DoseWithMedName; index: number }) => {
    const status = getStatusInfo(item);

    return (
      <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 60).duration(350)}>
        <Card style={[styles.card, { borderLeftColor: status.color, borderLeftWidth: 5 }]}>
          <View style={styles.cardTop}>
            <View style={[styles.statusBadge, { backgroundColor: status.bgColor }]}>
              <Ionicons name={status.icon} size={22} color={status.color} />
              <Text style={[styles.statusText, { color: status.color }]}>{status.text}</Text>
            </View>
            <Text style={styles.dateText}>{formatDateTime(item.scheduled_at)}</Text>
          </View>

          <Text style={styles.medName}>💊 {item.medication_name}</Text>

          {item.taken === null && (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.takenBtn]}
                onPress={() => handleMarkDose(item, true)}
                activeOpacity={0.7}
              >
                <Ionicons name="thumbs-up" size={26} color={COLORS.white} />
                <Text style={styles.actionBtnText}>Sí la tomé</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.skippedBtn]}
                onPress={() => handleMarkDose(item, false)}
                activeOpacity={0.7}
              >
                <Ionicons name="close-circle" size={26} color={COLORS.white} />
                <Text style={styles.actionBtnText}>No la tomé</Text>
              </TouchableOpacity>
            </View>
          )}

          {item.taken !== null && (
            <TouchableOpacity
              style={styles.correctBtn}
              onPress={() => handleCorrectDose(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="create-outline" size={18} color={COLORS.textSecondary} />
              <Text style={styles.correctBtnText}>¿Fue un error? Corregir</Text>
            </TouchableOpacity>
          )}
        </Card>
      </Animated.View>
    );
  };

  const renderEmpty = () => (
    <Animated.View entering={FadeInDown.duration(350)} style={styles.emptyContainer}>
      <Ionicons name="calendar-outline" size={80} color={COLORS.textLight} />
      <Text style={styles.emptyTitle}>Sin registros</Text>
      <Text style={styles.emptyText}>
        {filter === 'all'
          ? 'Aquí aparecerán tus registros de tomas cuando agregues medicamentos y llegue la hora de tomarlos.'
          : 'No hay registros que coincidan con este filtro.'}
      </Text>
    </Animated.View>
  );

  const syncPendingDoses = async () => {
    if (!activePatientId) return;
    const result = await reconcileDoseRecords(activePatientId);
    await fetchRecords();

    if (result.medsChecked === 0) {
      alert('Info', 'No tienes medicamentos activos.');
    } else if (result.inserted === 0 && result.updatedToSkipped === 0) {
      alert('Info', 'Tu historial ya está al día.');
    } else {
      alert('Listo', `Se actualizó tu historial: ${result.inserted} registro(s) nuevo(s), ${result.updatedToSkipped} marcado(s) como no tomados.`);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Historial de Tomas"
        subtitle={`${filteredRecords.length} registro(s)`}
        rightElement={
          <TouchableOpacity style={styles.generateBtn} onPress={syncPendingDoses} activeOpacity={0.7}>
            <Ionicons name="sync-outline" size={26} color={COLORS.white} />
          </TouchableOpacity>
        }
      >
        <View style={styles.filterRow}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setFilter(f.key)}
                activeOpacity={0.7}
              >
                <Ionicons name={f.icon} size={16} color={active ? COLORS.primary : COLORS.white} />
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScreenHeader>
      <PatientBanner />

      {/* Records List */}
      <FlatList
        data={filteredRecords}
        keyExtractor={(item) => item.id}
        renderItem={renderRecord}
        ListEmptyComponent={!loading ? renderEmpty : null}
        contentContainerStyle={filteredRecords.length === 0 ? styles.emptyList : styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  generateBtn: {
    width: TOUCH_TARGET.minWidth,
    height: TOUCH_TARGET.minHeight,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  filterChipActive: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.white,
  },
  filterChipText: {
    fontSize: FONTS.sizeSmall - 2,
    fontFamily: FONTS.family.semiBold,
    color: COLORS.white,
  },
  filterChipTextActive: {
    color: COLORS.primary,
  },
  list: {
    padding: SPACING.md,
    paddingBottom: 120,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  card: {
    marginBottom: SPACING.md,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    gap: 6,
  },
  statusText: {
    fontSize: FONTS.sizeSmall,
    fontFamily: FONTS.family.bold,
  },
  dateText: {
    fontSize: FONTS.sizeSmall,
    fontFamily: FONTS.family.regular,
    color: COLORS.textSecondary,
  },
  medName: {
    fontSize: FONTS.sizeLarge,
    fontFamily: FONTS.family.bold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  actionRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: TOUCH_TARGET.minHeight,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
  },
  takenBtn: {
    backgroundColor: COLORS.success,
  },
  skippedBtn: {
    backgroundColor: COLORS.danger,
  },
  actionBtnText: {
    color: COLORS.white,
    fontSize: FONTS.sizeMedium,
    fontFamily: FONTS.family.bold,
  },
  correctBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  correctBtnText: {
    fontSize: FONTS.sizeSmall - 2,
    fontFamily: FONTS.family.semiBold,
    color: COLORS.textSecondary,
    textDecorationLine: 'underline',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyTitle: {
    fontSize: FONTS.sizeLarge,
    fontFamily: FONTS.family.bold,
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  emptyText: {
    fontSize: FONTS.sizeMedium,
    fontFamily: FONTS.family.regular,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
    lineHeight: 30,
  },
});
