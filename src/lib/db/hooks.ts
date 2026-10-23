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
  return useLiveQuery(async () => (exerciseId ? ((await getDb().exercisePrefs.toArray()).find((p) => p.exerciseId === exerciseId) ?? null) : null), [exerciseId]);
}

export function useExercisePrefs() {
  return useLiveQuery(() => getDb().exercisePrefs.toArray(), []);
}

/** Alle niet-verwijderde workouts, nieuwste eerst. */
export function useWorkouts(): Workout[] | undefined {
  return useLiveQuery(
    async () => (await getDb().workouts.toArray()).filter((w) => !w.deletedAt).sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt)),
    [],
  );
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
  return useLiveQuery(async () => (await getDb().measurementTypes.toArray()).filter((t) => !t.deletedAt).sort((a, b) => a.sortOrder - b.sortOrder), []);
}

export function useMeasurements() {
  return useLiveQuery(
    async () => (await getDb().measurements.toArray()).filter((m) => !m.deletedAt).sort((a, b) => Date.parse(a.measuredAt) - Date.parse(b.measuredAt)),
    [],
  );
}

export function useGoals() {
  return useLiveQuery(async () => (await getDb().goals.toArray()).filter((g) => !g.deletedAt), []);
}

export function useWidgets() {
  return useLiveQuery(async () => (await getDb().widgets.toArray()).filter((w) => !w.deletedAt).sort((a, b) => a.position - b.position), []);
}

export function useProfile() {
  return useLiveQuery(async () => (await getDb().profile.get(requireUserId())) ?? DEFAULT_PROFILE(requireUserId()), []);
}

export function useOutboxCount() {
  return useLiveQuery(() => getDb().outbox.count(), []);
}

export function useOutbox() {
  return useLiveQuery(async () => (await getDb().outbox.toArray()).sort((a, b) => a.seq! - b.seq!), []);
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
