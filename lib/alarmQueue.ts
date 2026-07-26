/**
 * COLA COMPARTIDA DE ALARMAS
 *
 * Antes, cada medicamento con una dosis pendiente abría su propia pantalla
 * `/alarm` apilada encima de la anterior (router.push repetido). Si dos
 * medicamentos sonaban cerca en el tiempo, quedaban DOS instancias de la
 * pantalla montadas a la vez, cada una con su propio sonido en loop — la de
 * abajo quedaba enterrada, sonando para siempre, sin botón para detenerla.
 *
 * Esta cola resuelve eso: solo existe UNA pantalla de alarma a la vez, que
 * siempre muestra `getAlarmQueue()[0]`. Los medicamentos adicionales se
 * agregan a la cola en vez de abrir una pantalla nueva; al confirmar el
 * actual, la pantalla avanza sola al siguiente.
 */

export interface AlarmQueueItem {
  medicationId: string;
  scheduledAt: string;
}

function keyOf(item: AlarmQueueItem): string {
  return `${item.medicationId}_${item.scheduledAt || ''}`;
}

let queue: AlarmQueueItem[] = [];

// Dosis recién confirmadas (taken=true) — un recordatorio tardío de la misma
// dosis que llegue después no debe volver a encolarla ni reabrir la alarma.
// TTL de 15 min: tiempo de sobra para que expo-notifications entregue
// cualquier recordatorio atrasado de esa dosis.
const confirmedKeys = new Set<string>();

type Listener = () => void;
let listeners: Listener[] = [];

function notify(): void {
  for (const l of listeners) l();
}

export function subscribeAlarmQueue(listener: Listener): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

/**
 * Agrega una alarma a la cola si no está ya encolada ni fue recién
 * confirmada. Devuelve true si la agregó (hay que asegurarse de que la
 * pantalla de alarma esté abierta), false si no hizo falta hacer nada.
 */
export function enqueueAlarm(item: AlarmQueueItem): boolean {
  const key = keyOf(item);
  if (confirmedKeys.has(key)) return false;
  if (queue.some((q) => keyOf(q) === key)) return false;
  queue.push(item);
  notify();
  return true;
}

export function getAlarmQueue(): AlarmQueueItem[] {
  return queue;
}

/**
 * Quita un item de la cola (dosis confirmada, pospuesta, o abandonada por
 * error de guardado). No lo marca como "confirmada" — usar markConfirmed
 * para eso, ya que un snooze necesita poder volver a encolarse en 5 min.
 */
export function removeFromQueue(item: AlarmQueueItem): void {
  const key = keyOf(item);
  const before = queue.length;
  queue = queue.filter((q) => keyOf(q) !== key);
  if (queue.length !== before) notify();
}

/**
 * Marca una dosis como confirmada (taken=true) para que recordatorios
 * tardíos de esa misma dosis no la vuelvan a encolar.
 */
export function markConfirmed(item: AlarmQueueItem): void {
  const key = keyOf(item);
  confirmedKeys.add(key);
  setTimeout(() => confirmedKeys.delete(key), 15 * 60 * 1000);
}

/**
 * Si esta dosis se confirmó hace poco (markConfirmed) EN ESTA SESIÓN de la
 * app. Se usa como señal optimista en Inicio: no depende de que Supabase ya
 * haya recibido el guardado (que ahora corre en segundo plano, ver
 * alarm.tsx), así la tarjeta de "pendiente" desaparece al instante en vez de
 * esperar a la próxima sincronización.
 */
export function isConfirmed(item: AlarmQueueItem): boolean {
  return confirmedKeys.has(keyOf(item));
}
