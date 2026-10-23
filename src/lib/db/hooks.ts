import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { getDb } from './schema';
import type { Exercise, Template, Workout } from './types';
import { DEFAULT_PROFILE } from './repo';
import { requireUserId } from './session';

// Leeshooks: de UI leest altijd uit de lokale database (werkt offline, reageert meteen op wijzigingen).
// `undefined` betekent "nog aan het laden".

export function useExercises(): Exercise[] | undefined {
  return useLiveQuery(async () => (await getDb().exercises.toArray()).filter((e) => !e.deletedAt).sort((a, b) => a.name.localeCompare(b.name)), []);
}

/** Alle oefeningen inclusief verwijderde (voor oude templates/history). */
export function useExerciseMap(): Map<string, Exercise> | undefined {
  const all = useLiveQuery(() => getDb().exercises.toArray(), []);
  return useMemo(() => (all ? new Map(all.map((e) => [e.id, e])) : undefined), [all]);
}

export function useExercise(id: string | undefined) {
  return useLiveQuery(() => (id ? getDb().exercises.get(id) : undefined), [id]);
}

export function useExercisePref(exerciseId: string | undefined) {
  return useLiveQuery(async () => (exerciseId ? ((await getDb().exercisePrefs.where('exerciseId').equals(exerciseId).first()) ?? null) : null), [exerciseId]);
}

export function useExercisePrefs() {
  return useLiveQuery(() => getDb().exercisePrefs.toArray(), []);
}

/** Alle niet-verwijderde workouts, nieuwste eerst. */
export function useWorkouts(): Workout[] | undefined {
  return useLiveQuery(async () => (await getDb().workouts.orderBy('startedAt').reverse().toArray()).filter((w) => !w.deletedAt), []);
}

export function useWorkout(id: string | undefined) {
  return useLiveQuery(() => (id ? getDb().workouts.get(id) : undefined), [id]);
}

export function useTemplates(): Template[] | undefined {
  return useLiveQuery(async () => (await getDb().templates.toArray()).filter((t) => !t.deletedAt).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)), []);
}

export function useTemplate(id: string | undefined) {
  return useLiveQuery(() => (id ? getDb().templates.get(id) : undefined), [id]);
}

export function useMeasurementTypes() {
  return useLiveQuery(async () => (await getDb().measurementTypes.orderBy('sortOrder').toArray()).filter((t) => !t.deletedAt), []);
}

export function useMeasurements() {
  return useLiveQuery(async () => (await getDb().measurements.orderBy('measuredAt').toArray()).filter((m) => !m.deletedAt), []);
}

export function useGoals() {
  return useLiveQuery(async () => (await getDb().goals.toArray()).filter((g) => !g.deletedAt), []);
}

export function useWidgets() {
  return useLiveQuery(async () => (await getDb().widgets.orderBy('position').toArray()).filter((w) => !w.deletedAt), []);
}

export function useProfile() {
  return useLiveQuery(async () => (await getDb().profile.get(requireUserId())) ?? DEFAULT_PROFILE(requireUserId()), []);
}

export function useOutboxCount() {
  return useLiveQuery(() => getDb().outbox.count(), []);
}

export function useOutbox() {
  return useLiveQuery(() => getDb().outbox.orderBy('seq').toArray(), []);
}

export function useConflicts() {
  return useLiveQuery(() => getDb().conflicts.toArray(), []);
}

/** Datum van de laatste uitvoering per template. */
export function useLastPerformed(): Map<string, string> | undefined {
  const workouts = useWorkouts();
  return useMemo(() => {
    if (!workouts) return undefined;
    const m = new Map<string, string>();
    for (const w of workouts) if (w.templateId && !m.has(w.templateId)) m.set(w.templateId, w.startedAt);
    return m;
  }, [workouts]);
}
