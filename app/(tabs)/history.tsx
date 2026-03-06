import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, TOUCH_TARGET } from '@/lib/theme';
import { DoseRecord } from '@/lib/types';

interface DoseWithMedName extends DoseRecord {
  medication_name?: string;
}

export default function HistoryScreen() {
  const { user } = useAuth();
  const [records, setRecords] = useState<DoseWithMedName[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchRecords = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('dose_records')
      .select('*, medications(name)')
      .eq('user_id', user.id)
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
      fetchRecords();
    }, [user])
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
      Alert.alert('Error', 'No se pudo actualizar el registro.');
      console.error('Update error:', error);
    } else {
      fetchRecords();
    }
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

  const renderRecord = ({ item }: { item: DoseWithMedName }) => {
    const status = getStatusInfo(item);

    return (
      <View style={[styles.card, { borderLeftColor: status.color, borderLeftWidth: 5 }]}>
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
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="calendar-outline" size={80} color={COLORS.textLight} />
      <Text style={styles.emptyTitle}>Sin historial</Text>
      <Text style={styles.emptyText}>
        Aquí aparecerán tus registros de tomas cuando agregues medicamentos y llegue la hora de tomarlos.
      </Text>
    </View>
  );

  const generatePendingDoses = async () => {
    if (!user) return;

    const { data: meds } = await supabase
      .from('medications')
      .select('*')
      .eq('user_id', user.id)
      .eq('active', true);

    if (!meds || meds.length === 0) {
      Alert.alert('Info', 'No tienes medicamentos activos.');
      return;
    }

    const now = new Date();
    const inserts: any[] = [];

    for (const med of meds) {
      const [h, m] = med.start_time.split(':').map(Number);
      const startToday = new Date();
      startToday.setHours(h, m, 0, 0);

      let doseTime = new Date(startToday);

      while (doseTime <= now) {
        const { data: existing } = await supabase
          .from('dose_records')
          .select('id')
          .eq('medication_id', med.id)
          .eq('scheduled_at', doseTime.toISOString())
          .maybeSingle();

        if (!existing) {
          inserts.push({
            medication_id: med.id,
            user_id: user.id,
            scheduled_at: doseTime.toISOString(),
            taken: null,
            responded_at: null,
          });
        }

        doseTime = new Date(doseTime.getTime() + med.frequency_hours * 60 * 60 * 1000);
      }
    }

    if (inserts.length > 0) {
      await supabase.from('dose_records').insert(inserts);
      fetchRecords();
      Alert.alert('Listo', `Se generaron ${inserts.length} registro(s) pendiente(s).`);
    } else {
      Alert.alert('Info', 'No hay dosis pendientes por registrar.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header — Verde Bosque Primario */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Historial de Tomas</Text>
          <Text style={styles.headerSubtitle}>{records.length} registro(s)</Text>
        </View>
        <TouchableOpacity style={styles.generateBtn} onPress={generatePendingDoses} activeOpacity={0.7}>
          <Ionicons name="add-circle-outline" size={28} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {/* Records List */}
      <FlatList
        data={records}
        keyExtractor={(item) => item.id}
        renderItem={renderRecord}
        ListEmptyComponent={!loading ? renderEmpty : null}
        contentContainerStyle={records.length === 0 ? styles.emptyList : styles.list}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg + 4,
    borderBottomLeftRadius: BORDER_RADIUS.xl,
    borderBottomRightRadius: BORDER_RADIUS.xl,
  },
  headerTitle: {
    fontSize: FONTS.sizeTitle,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  headerSubtitle: {
    fontSize: FONTS.sizeMedium,
    color: '#C8E6C9',
    marginTop: 4,
  },
  generateBtn: {
    width: TOUCH_TARGET.minWidth,
    height: TOUCH_TARGET.minHeight,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
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
    fontWeight: 'bold',
  },
  dateText: {
    fontSize: FONTS.sizeSmall,
    color: COLORS.textSecondary,
  },
  medName: {
    fontSize: FONTS.sizeLarge,
    fontWeight: 'bold',
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
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyTitle: {
    fontSize: FONTS.sizeLarge,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  emptyText: {
    fontSize: FONTS.sizeMedium,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
    lineHeight: 30,
  },
});
