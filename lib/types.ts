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
