import { getDb } from './schema';
import { requireUserId } from './session';
import type {
  DashboardWidget,
  Exercise,
  ExercisePref,
  Goal,
  Measurement,
  MeasurementType,
  Profile,
  Template,
  Workout,
} from './types';
import { enqueue } from '@/lib/sync/outbox';
import { notifyLocalChange } from '@/lib/sync/scheduler';
import { entityKey } from '@/lib/sync/types';
import * as M from '@/lib/sync/mappers';
import { newId } from '@/lib/ids';

// Alle schrijfacties van de app. Elke actie schrijft in ÉÉN lokale transactie zowel de data als de
// outbox-operatie: een wijziging is dus nooit "lokaal opgeslagen maar vergeten te synchroniseren".

const nowIso = () => new Date().toISOString();

// ───────────── exercises
export async function saveExercise(ex: Exercise): Promise<void> {
  const db = getDb();
  const uid = requireUserId();
  if (ex.userId === null) throw new Error('Standaardoefeningen kunnen niet gewijzigd worden.');
  await db.transaction('rw', db.exercises, db.outbox, async () => {
    await db.exercises.put(ex);
    await enqueue(db, { kind: 'upsert', key: entityKey('exercises', ex.id), table: 'exercises', row: M.exerciseToRemote(ex, uid) });
  });
  notifyLocalChange();
}

export async function deleteExercise(id: string): Promise<void> {
  const ex = await getDb().exercises.get(id);
  if (!ex) return;
  await saveExercise({ ...ex, deletedAt: nowIso() });
}

export async function saveExercisePref(exerciseId: string, patch: Partial<Pick<ExercisePref, 'notes' | 'restSec'>>): Promise<void> {
  const db = getDb();
  const uid = requireUserId();
  await db.transaction('rw', db.exercisePrefs, db.outbox, async () => {
    const cur = await db.exercisePrefs.where('exerciseId').equals(exerciseId).first();
    const pref: ExercisePref = cur
      ? { ...cur, ...patch }
      : { id: newId(), exerciseId, notes: null, restSec: null, serverUpdatedAt: null, deletedAt: null, ...patch };
    await db.exercisePrefs.put(pref);
    await enqueue(db, { kind: 'upsert', key: entityKey('exercisePrefs', pref.id), table: 'exercise_prefs', row: M.exercisePrefToRemote(pref, uid) });
  });
  notifyLocalChange();
}

// ───────────── templates
export async function saveTemplate(t: Template): Promise<void> {
  const db = getDb();
  await db.transaction('rw', db.templates, db.outbox, async () => {
    await db.templates.put(t);
    await enqueue(db, { kind: 'rpc', key: entityKey('templates', t.id), fn: 'upsert_template', payload: M.templateToPayload(t) });
  });
  notifyLocalChange();
}

export async function deleteTemplate(id: string): Promise<void> {
  const t = await getDb().templates.get(id);
  if (t) await saveTemplate({ ...t, deletedAt: nowIso() });
}

/** Kopie met nieuwe ids (template, oefeningen en sets). */
export function cloneTemplate(t: Template, name: string): Template {
  return {
    ...t,
    id: newId(),
    name,
    serverUpdatedAt: null,
    deletedAt: null,
    exercises: t.exercises.map((te) => ({ ...te, id: newId(), sets: te.sets.map((s) => ({ ...s, id: newId() })) })),
  };
}

// ───────────── workouts
export async function saveWorkout(w: Workout): Promise<void> {
  const db = getDb();
  await db.transaction('rw', db.workouts, db.outbox, async () => {
    await db.workouts.put(w);
    await enqueue(db, { kind: 'rpc', key: entityKey('workouts', w.id), fn: 'upsert_workout', payload: M.workoutToPayload(w) });
  });
  notifyLocalChange();
}

export async function deleteWorkout(id: string): Promise<void> {
  const w = await getDb().workouts.get(id);
  if (w) await saveWorkout({ ...w, deletedAt: nowIso() });
}

/**
 * Import (Strong-CSV): alleen workouts die lokaal nog niet bestaan worden toegevoegd. Server-side is
 * import_workouts ook idempotent (on conflict do nothing). Opgeknipt in blokken; elk blok is één transactie.
 */
export async function importWorkouts(newExercises: Exercise[], workouts: Workout[], chunkSize = 40): Promise<{ added: number; skipped: number }> {
  const db = getDb();
  const uid = requireUserId();
  let added = 0;
  let skipped = 0;
  await db.transaction('rw', db.exercises, db.workouts, db.outbox, async () => {
    const exToAdd: Exercise[] = [];
    for (const ex of newExercises) if (!(await db.exercises.get(ex.id))) exToAdd.push(ex);
    await db.exercises.bulkPut(exToAdd);

    const fresh: Workout[] = [];
    for (const w of workouts) {
      if (await db.workouts.get(w.id)) skipped++;
      else fresh.push(w);
    }
    await db.workouts.bulkPut(fresh);
    added = fresh.length;

    for (let i = 0; i < Math.max(fresh.length, exToAdd.length ? 1 : 0); i += chunkSize) {
      const chunk = fresh.slice(i, i + chunkSize);
      await enqueue(db, {
        kind: 'rpc',
        key: `import:${chunk[0]?.id ?? newId()}`,
        fn: 'import_workouts',
        payload: {
          exercises: i === 0 ? exToAdd.map((e) => M.exerciseToRemote(e, uid)) : [],
          workouts: chunk.map((w) => M.workoutToPayload(w)),
        },
      });
    }
  });
  notifyLocalChange();
  return { added, skipped };
}

// ───────────── measurements
export async function saveMeasurement(m: Measurement): Promise<void> {
  const db = getDb();
  const uid = requireUserId();
  await db.transaction('rw', db.measurements, db.outbox, async () => {
    await db.measurements.put(m);
    await enqueue(db, { kind: 'upsert', key: entityKey('measurements', m.id), table: 'body_measurements', row: M.measurementToRemote(m, uid) });
  });
  notifyLocalChange();
}

export async function deleteMeasurement(id: string): Promise<void> {
  const m = await getDb().measurements.get(id);
  if (m) await saveMeasurement({ ...m, deletedAt: nowIso() });
}

export async function saveMeasurementType(t: MeasurementType): Promise<void> {
  const db = getDb();
  const uid = requireUserId();
  if (t.userId === null) throw new Error('Standaardmeettypes kunnen niet gewijzigd worden.');
  await db.transaction('rw', db.measurementTypes, db.outbox, async () => {
    await db.measurementTypes.put(t);
    await enqueue(db, { kind: 'upsert', key: entityKey('measurementTypes', t.id), table: 'measurement_types', row: M.measurementTypeToRemote(t, uid) });
  });
  notifyLocalChange();
}

// ───────────── goals
export async function saveGoal(g: Goal): Promise<void> {
  const db = getDb();
  const uid = requireUserId();
  await db.transaction('rw', db.goals, db.outbox, async () => {
    await db.goals.put(g);
    await enqueue(db, { kind: 'upsert', key: entityKey('goals', g.id), table: 'goals', row: M.goalToRemote(g, uid) });
  });
  notifyLocalChange();
}

export async function deleteGoal(id: string): Promise<void> {
  const g = await getDb().goals.get(id);
  if (g) await saveGoal({ ...g, deletedAt: nowIso() });
}

// ───────────── widgets
export async function saveWidgets(widgets: DashboardWidget[]): Promise<void> {
  const db = getDb();
  const uid = requireUserId();
  await db.transaction('rw', db.widgets, db.outbox, async () => {
    for (const w of widgets) {
      await db.widgets.put(w);
      await enqueue(db, { kind: 'upsert', key: entityKey('widgets', w.id), table: 'dashboard_widgets', row: M.widgetToRemote(w, uid) });
    }
  });
  notifyLocalChange();
}

// ───────────── profile
export const DEFAULT_PROFILE = (id: string): Profile => ({
  id,
  displayName: null,
  avatarUrl: null,
  weeklyWorkoutGoal: 3,
  defaultRestSec: 120,
  serverUpdatedAt: null,
});

export async function saveProfile(p: Profile): Promise<void> {
  const db = getDb();
  await db.transaction('rw', db.profile, db.outbox, async () => {
    await db.profile.put(p);
    await enqueue(db, { kind: 'upsert', key: entityKey('profile', p.id), table: 'profiles', row: M.profileToRemote(p) });
  });
  notifyLocalChange();
}
