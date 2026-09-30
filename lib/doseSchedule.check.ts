// Comprobación de la rejilla de dosis. Sin framework: es aritmética de fechas
// pura, así que corre en Node a secas.
//
//   node --experimental-strip-types lib/doseSchedule.check.ts
//
// Cada caso es un defecto real que se arregló aquí. Si alguno vuelve a fallar,
// alguien rompió cuándo suena una alarma de medicamento.

import assert from 'node:assert/strict';
import { doseGrid, roundTo5Minutes, toStartTime } from './doseSchedule.ts';

const at = (iso: string) => new Date(iso);
const hhmm = (dates: Date[]) =>
  dates.map((d) => `${['D', 'L', 'M', 'X', 'J', 'V', 'S'][d.getDay()]} ${toStartTime(d)}`);

// ── 1. El ciclo NO se rompe cuando la hora de inicio ya pasó hoy ─────────────
// El bug original: alta a las 14:00 de un "cada 4 h desde las 8:00" saltaba a
// mañana 8:00 y se perdía 16:00 y 20:00 de hoy.
{
  const now = at('2026-09-30T14:00:00');
  const grid = doseGrid({
    startTime: '08:00',
    frequencyHours: 4,
    from: now,
    to: at('2026-09-30T23:59:59'),
    now,
  });
  assert.deepEqual(hhmm(grid), ['X 16:00', 'X 20:00'], 'debe dar las tomas que faltan HOY');
}

// ── 2. Se respetan los días de la semana ────────────────────────────────────
// El bug original: las notificaciones sonaban los siete días aunque el
// medicamento fuera solo de ciertos días.
{
  const now = at('2026-09-30T00:00:00'); // miércoles
  const grid = doseGrid({
    startTime: '09:00',
    frequencyHours: 24,
    daysOfWeek: ['mon', 'wed', 'fri'],
    from: now,
    to: at('2026-10-06T23:59:59'),
    now,
  });
  // Mié 30 sep, vie 2 oct, lun 5 oct. El miércoles 7 ya cae fuera del rango.
  assert.deepEqual(
    hhmm(grid),
    ['X 09:00', 'V 09:00', 'L 09:00'],
    'solo lunes, miércoles y viernes'
  );
}

// ── 3. Los días inactivos NO desplazan el ciclo ─────────────────────────────
// Saltarse un día no debe correr la hora del resto.
{
  const now = at('2026-09-30T00:00:00');
  const grid = doseGrid({
    startTime: '07:00',
    frequencyHours: 12,
    daysOfWeek: ['wed', 'fri'],
    from: now,
    to: at('2026-10-02T23:59:59'),
    now,
  });
  assert.deepEqual(
    hhmm(grid),
    ['X 07:00', 'X 19:00', 'V 07:00', 'V 19:00'],
    'la hora se mantiene aunque se salte el jueves'
  );
}

// ── 4. La rejilla es continua a través de la medianoche ─────────────────────
{
  const now = at('2026-09-30T22:00:00');
  const grid = doseGrid({
    startTime: '22:00',
    frequencyHours: 5,
    from: now,
    to: at('2026-10-01T12:00:00'),
    now,
  });
  assert.deepEqual(hhmm(grid), ['X 22:00', 'J 03:00', 'J 08:00'], 'cruza la medianoche sin reiniciar');
}

// ── 5. El historial hacia atrás cae en la misma rejilla ─────────────────────
// Es lo que garantiza que la alarma y el historial digan la misma hora.
{
  const now = at('2026-09-30T15:00:00');
  const grid = doseGrid({
    startTime: '08:40',
    frequencyHours: 4,
    from: at('2026-09-30T00:00:00'),
    to: at('2026-09-30T23:59:59'),
    now,
  });
  assert.deepEqual(
    hhmm(grid),
    ['X 00:40', 'X 04:40', 'X 08:40', 'X 12:40', 'X 16:40', 'X 20:40'],
    'mismo minuto :40 todo el día, hacia atrás y hacia adelante'
  );
}

// ── 6. Una frecuencia inválida devuelve vacío en vez de colgar ──────────────
{
  const now = at('2026-09-30T10:00:00');
  for (const bad of [0, -4, NaN]) {
    const grid = doseGrid({
      startTime: '08:00',
      frequencyHours: bad,
      from: now,
      to: at('2026-10-01T00:00:00'),
      now,
    });
    assert.deepEqual(grid, [], `frecuencia ${bad} no debe colgar el bucle`);
  }
}

// ── 7. Redondeo a 5 minutos del ancla "ya me la tomé" ───────────────────────
{
  assert.equal(toStartTime(roundTo5Minutes(at('2026-09-30T20:37:00'))), '20:35');
  assert.equal(toStartTime(roundTo5Minutes(at('2026-09-30T20:38:00'))), '20:40');
  assert.equal(toStartTime(roundTo5Minutes(at('2026-09-30T23:58:00'))), '00:00', 'redondea cruzando el día');
}

console.log('doseSchedule: 7/7 comprobaciones OK');
