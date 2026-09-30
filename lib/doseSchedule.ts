// ─────────────────────────────────────────────────────────────────────────────
// La rejilla de dosis — ÚNICA fuente de verdad sobre cuándo toca una toma.
//
// Antes había dos implementaciones de esta misma cuenta y no coincidían:
//
//   · `computeDoseDates` (notificaciones) anclaba en start_time de hoy y, si
//     esa hora ya había pasado, SALTABA A MAÑANA a la misma hora. Con "cada 4 h
//     desde las 8:00" dado de alta a las 14:00, se perdían las tomas de hoy a
//     las 16:00 y 20:00 — el ciclo se rompía el primer día.
//   · `computeDoseDatesInRange` (historial) recorría la rejilla continua cada
//     N horas, sin saltos.
//
// Resultado: el historial mostraba una dosis a una hora y la alarma sonaba a
// otra. Además, solo el historial respetaba `days_of_week`; las notificaciones
// sonaban los siete días aunque el medicamento fuera de lunes, miércoles y
// viernes.
//
// Este archivo no importa nada de Expo ni de React Native a propósito: es
// aritmética de fechas pura, y así puede comprobarse con `doseSchedule.check.ts`
// sin levantar la app.
// ─────────────────────────────────────────────────────────────────────────────

export const DAY_TO_JS: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

const ALL_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export interface DoseGridOptions {
  /** Hora ancla del ciclo, "HH:mm" en 24 h. */
  startTime: string;
  /** Cada cuántas horas se repite. Debe ser > 0. */
  frequencyHours: number;
  /** Días activos. Vacío o ausente = todos. */
  daysOfWeek?: string[] | null;
  /** Primera fecha incluida. */
  from: Date;
  /** Última fecha incluida. */
  to: Date;
  /**
   * Momento desde el que se ancla la rejilla (el día del que se toma la hora).
   * Parametrizado para poder comprobar la función sin depender del reloj.
   */
  now?: Date;
}

/**
 * Todas las horas de dosis entre `from` y `to` (ambas inclusive).
 *
 * La rejilla es continua: se ancla en `startTime` del día de `now` y se extiende
 * hacia atrás y hacia adelante en múltiplos de `frequencyHours`, sin reiniciarse
 * cada medianoche. Los días no activos se omiten de la salida, pero NO desplazan
 * el ciclo — un medicamento de lunes y miércoles cada 8 h mantiene las mismas
 * horas que tendría si fuera diario.
 */
export function doseGrid({
  startTime,
  frequencyHours,
  daysOfWeek,
  from,
  to,
  now = new Date(),
}: DoseGridOptions): Date[] {
  // Una frecuencia de 0 o negativa colgaría los bucles de abajo. El formulario
  // ya la valida, pero esto decide cuándo suena una alarma de medicamento: vale
  // más devolver vacío que congelar la app.
  if (!(frequencyHours > 0)) return [];

  const [h, m] = startTime.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return [];

  const freqMs = frequencyHours * 60 * 60 * 1000;
  const allowed = new Set(
    (daysOfWeek?.length ? daysOfWeek : ALL_DAYS).map((d) => DAY_TO_JS[d])
  );

  const anchor = new Date(now);
  anchor.setHours(h, m, 0, 0);

  // Retroceder hasta quedar en o antes de `from`, luego avanzar recogiendo.
  let cursor = new Date(anchor);
  while (cursor.getTime() > from.getTime()) {
    cursor = new Date(cursor.getTime() - freqMs);
  }

  const dates: Date[] = [];
  while (cursor.getTime() <= to.getTime()) {
    if (cursor.getTime() >= from.getTime() && allowed.has(cursor.getDay())) {
      dates.push(new Date(cursor));
    }
    cursor = new Date(cursor.getTime() + freqMs);
  }
  return dates;
}

/**
 * Redondea una hora a los 5 minutos más cercanos.
 *
 * Se usa cuando el ancla del ciclo es "me la acabo de tomar": la hora real es
 * un minuto arbitrario (20:37) y el horario resultante hereda ese minuto para
 * siempre. Dos minutos no cambian nada clínicamente en un ciclo de horas, y
 * "20:35" se lee mucho mejor que "20:37" a los 80 años.
 */
export function roundTo5Minutes(date: Date): Date {
  const out = new Date(date);
  const rounded = Math.round(out.getMinutes() / 5) * 5;
  out.setMinutes(rounded, 0, 0);
  return out;
}

/** Formatea una fecha como "HH:mm" en 24 h, que es como se guarda `start_time`. */
export function toStartTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
