import { getDb } from '@/lib/db/schema';
import type { ActiveWorkout, Workout } from '@/lib/db/types';
import { enqueue } from '@/lib/sync/outbox';
import { notifyLocalChange } from '@/lib/sync/scheduler';
import { entityKey } from '@/lib/sync/types';
import { workoutToPayload } from '@/lib/sync/mappers';
import { toFinishedWorkout } from './logic';

// De lopende workout staat in IndexedDB en wordt bij ELKE wijziging bewaard.
// Daardoor overleeft ze een refresh, crash of het sluiten van de app.

const KEY = 'current' as const;

export async function loadActive(): Promise<ActiveWorkout | null> {
  const row = await getDb().active.get(KEY);
  if (!row) return null;
  const { key: _key, ...a } = row;
  return a;
}

export async function saveActive(a: ActiveWorkout): Promise<void> {
  await getDb().active.put({ ...a, key: KEY });
}

export async function discardActive(): Promise<void> {
  await getDb().active.delete(KEY);
}

/**
 * Workout afronden. Idempotent:
 *  - de workout-id staat vast vanaf de start, dus de server-upsert kan nooit een tweede workout maken;
 *  - lokaal draait alles in één transactie; een tweede (dubbele) aanroep vindt geen actieve workout meer
 *    en geeft gewoon de reeds afgeronde workout terug.
 */
export async function finishActive(workoutId: string, opts: { keepUnchecked: boolean; note: string | null }, now = new Date()): Promise<Workout> {
  const db = getDb();
  const result = await db.transaction('rw', db.active, db.workouts, db.outbox, async () => {
    const existing = await db.workouts.get(workoutId);
    const row = await db.active.get(KEY);
    if (existing) {
      if (row?.id === workoutId) await db.active.delete(KEY);
      return existing;
    }
    if (!row || row.id !== workoutId) throw new Error('Er is geen lopende workout om af te ronden.');
    const { key: _key, ...active } = row;
    const w = toFinishedWorkout(active, opts, now);
    await db.workouts.put(w);
    await enqueue(db, { kind: 'rpc', key: entityKey('workouts', w.id), fn: 'upsert_workout', payload: workoutToPayload(w) });
    await db.active.delete(KEY);
    return w;
  });
  notifyLocalChange();
  return result;
}
