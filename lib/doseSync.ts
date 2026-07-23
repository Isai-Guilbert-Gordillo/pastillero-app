import { supabase } from './supabase';
import { Medication } from './types';

const DAY_TO_JS: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

// No reconstruir historial más viejo que esto, aunque el medicamento sea más antiguo
// (evita backfills gigantes en cuentas viejas y coincide con lo que History.tsx pedía).
const MAX_LOOKBACK_DAYS = 14;

/**
 * Todas las horas de dosis de `medication` entre `from` y `to` (ambos inclusive),
 * respetando days_of_week. Usa el mismo ancla que el resto de la app (start_time
 * de "hoy" + múltiplos de frequency_hours) para que coincida con lo que ya
 * muestra Inicio.
 */
function computeDoseDatesInRange(medication: Medication, from: Date, to: Date): Date[] {
  const [h, m] = medication.start_time.split(':').map(Number);
  const freqMs = medication.frequency_hours * 60 * 60 * 1000;
  const allowedDays = new Set(
    (medication.days_of_week?.length ? medication.days_of_week : ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])
      .map((d) => DAY_TO_JS[d])
  );

  const anchor = new Date();
  anchor.setHours(h, m, 0, 0);

  let cursor = new Date(anchor);
  while (cursor.getTime() > from.getTime()) {
    cursor = new Date(cursor.getTime() - freqMs);
  }

  const dates: Date[] = [];
  while (cursor.getTime() <= to.getTime()) {
    if (cursor.getTime() >= from.getTime() && allowedDays.has(cursor.getDay())) {
      dates.push(new Date(cursor));
    }
    cursor = new Date(cursor.getTime() + freqMs);
  }
  return dates;
}

export interface ReconcileResult {
  medsChecked: number;
  inserted: number;
  updatedToSkipped: number;
}

/**
 * Rellena en dose_records cualquier dosis pasada que nunca quedó registrada.
 * La dosis más reciente de cada medicamento se deja "pendiente" (null) — igual
 * que ya la trata Inicio — y todas las anteriores a esa se marcan "no tomada"
 * (false), porque su ventana ya se cerró. Es seguro llamarla seguido (por
 * ejemplo cada vez que Inicio o Historial toman foco): nunca reinserta lo que
 * ya existe, solo agrega lo que falta y cierra pendientes vencidas.
 */
export async function reconcileDoseRecords(userId: string): Promise<ReconcileResult> {
  const result: ReconcileResult = { medsChecked: 0, inserted: 0, updatedToSkipped: 0 };

  const { data: meds } = await supabase
    .from('medications')
    .select('*')
    .eq('user_id', userId)
    .eq('active', true);

  if (!meds || meds.length === 0) return result;
  result.medsChecked = meds.length;

  const now = new Date();
  const lookbackFloor = new Date(now.getTime() - MAX_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  for (const med of meds as Medication[]) {
    const createdAt = new Date(med.created_at);
    const from = createdAt > lookbackFloor ? createdAt : lookbackFloor;

    const doseDates = computeDoseDatesInRange(med, from, now);
    if (doseDates.length === 0) continue;

    const { data: existing } = await supabase
      .from('dose_records')
      .select('id, scheduled_at, taken')
      .eq('medication_id', med.id)
      .gte('scheduled_at', from.toISOString());

    const existingByTime = new Map(
      (existing ?? []).map((r: { id: string; scheduled_at: string; taken: boolean | null }) => [r.scheduled_at, r])
    );

    const inserts: Record<string, unknown>[] = [];
    const idsToSkip: string[] = [];

    doseDates.forEach((date, index) => {
      const iso = date.toISOString();
      const isMostRecent = index === doseDates.length - 1;
      const row = existingByTime.get(iso);

      if (!row) {
        inserts.push({
          medication_id: med.id,
          user_id: userId,
          scheduled_at: iso,
          taken: isMostRecent ? null : false,
          responded_at: null,
        });
      } else if (!isMostRecent && row.taken === null) {
        // Quedó pendiente de una toma anterior, pero ya llegó la siguiente — se cierra como no tomada.
        idsToSkip.push(row.id);
      }
    });

    if (inserts.length > 0) {
      const { error } = await supabase.from('dose_records').insert(inserts);
      if (!error) result.inserted += inserts.length;
    }
    if (idsToSkip.length > 0) {
      const { error } = await supabase
        .from('dose_records')
        .update({ taken: false })
        .in('id', idsToSkip);
      if (!error) result.updatedToSkipped += idsToSkip.length;
    }
  }

  return result;
}
