export interface Medication {
  id: string;
  user_id: string;
  name: string;
  photo_url: string | null;
  dose_mg: number;
  frequency_hours: number;
  start_time: string; // HH:mm format
  days_of_week: string[]; // e.g. ['mon','tue','wed','thu','fri','sat','sun']
  notification_ids: string[]; // IDs de notificaciones programadas en expo-notifications
  regimen_type: 'indefinido' | 'por_tiempo'; // 'indefinido' = crónico, sin fin. 'por_tiempo' = duración fija (ej. antibiótico)
  duration_days: number | null; // solo si regimen_type = 'por_tiempo'
  end_date: string | null; // YYYY-MM-DD, created_at + duration_days. Solo si regimen_type = 'por_tiempo'
  has_native_alarm: boolean; // la app cree que existe una alarma activa en el Reloj del teléfono
  native_alarm_cleanup_pending: boolean; // puede quedar una alarma vieja del Reloj sin borrar — mostrar recordatorio persistente
  created_at: string;
  active: boolean;
}

export interface DoseRecord {
  id: string;
  medication_id: string;
  user_id: string;
  scheduled_at: string; // ISO datetime
  taken: boolean | null; // null = pending, true = taken, false = skipped
  responded_at: string | null;
  created_at: string;
}

export interface MedicationWithNextDose extends Medication {
  next_dose_at?: Date;
}

export interface CaregiverLink {
  id: string;
  patient_user_id: string;
  patient_email: string;
  caregiver_user_id: string | null;
  caregiver_email: string | null;
  invite_code: string;
  status: 'pending' | 'accepted';
  created_at: string;
  accepted_at: string | null;
}
