import type { ActiveWorkout, Exercise, SetType, Template, TemplateExercise, Workout, WorkoutExercise, WorkoutSet } from '@/lib/db/types';
import { newId } from '@/lib/ids';
import { toLocalIso } from '@/domain/dates';
import { workoutElapsedSec } from '@/domain/timer';

// Pure functies voor de actieve workout. Geen opslag, geen UI: makkelijk te testen.

export function emptySet(type: SetType = 'normal'): WorkoutSet {
  return { id: newId(), type, weightKg: null, reps: null, durationSec: null, distanceM: null, rpe: null, completed: false, completedAt: null, note: null };
}

export function newActiveWorkout(name: string, now: Date, templateId: string | null = null): ActiveWorkout {
  return {
    id: newId(),
    name,
    startedAt: toLocalIso(now),
    templateId,
    note: null,
    exercises: [],
    pausedAt: null,
    pausedMs: 0,
    rest: null,
    finishing: false,
  };
}

export function workoutExerciseFrom(ex: Exercise, sets = 1, restSec: number | null = null): WorkoutExercise {
  return {
    id: newId(),
    exerciseId: ex.id,
    exerciseName: ex.name,
    exerciseType: ex.type,
    supersetGroup: null,
    restSec,
    note: null,
    sets: Array.from({ length: Math.max(1, sets) }, () => emptySet()),
  };
}

/** Workout starten vanuit een template. Template-waarden (reps, gewicht) worden voorgesteld, niet ingevuld als "gedaan". */
export function activeFromTemplate(t: Template, exercises: ReadonlyMap<string, Exercise>, now: Date): ActiveWorkout {
  const w = newActiveWorkout(t.name, now, t.id);
  w.exercises = t.exercises
    .map((te): WorkoutExercise | null => {
      const ex = exercises.get(te.exerciseId);
      if (!ex) return null;
      return {
        id: newId(),
        exerciseId: ex.id,
        exerciseName: ex.name,
        exerciseType: ex.type,
        supersetGroup: te.supersetGroup,
        restSec: te.restSec,
        note: te.note,
        sets: (te.sets.length ? te.sets : [{ type: 'normal' as const, reps: null, weightKg: null, durationSec: null, distanceM: null }]).map((s) => ({
          ...emptySet(s.type),
          // Doelwaarden uit de template als startwaarde; de gebruiker past aan en vinkt af.
          reps: s.reps,
          weightKg: s.weightKg,
          durationSec: s.durationSec,
          distanceM: s.distanceM,
        })),
      };
    })
    .filter((x): x is WorkoutExercise => x !== null);
  return w;
}

export function updateExercise(w: ActiveWorkout, weId: string, fn: (we: WorkoutExercise) => WorkoutExercise): ActiveWorkout {
  return { ...w, exercises: w.exercises.map((we) => (we.id === weId ? fn(we) : we)) };
}

export function updateSet(w: ActiveWorkout, weId: string, setId: string, patch: Partial<WorkoutSet>): ActiveWorkout {
  return updateExercise(w, weId, (we) => ({ ...we, sets: we.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) }));
}

export function addSet(w: ActiveWorkout, weId: string): ActiveWorkout {
  return updateExercise(w, weId, (we) => {
    const last = we.sets.at(-1);
    // Nieuwe set neemt de waarden van de vorige over als startpunt (niet afgevinkt).
    const s = emptySet(last?.type === 'warmup' ? 'normal' : 'normal');
    if (last) Object.assign(s, { weightKg: last.weightKg, reps: last.reps, durationSec: last.durationSec, distanceM: last.distanceM });
    return { ...we, sets: [...we.sets, s] };
  });
}

export function removeSet(w: ActiveWorkout, weId: string, setId: string): ActiveWorkout {
  return updateExercise(w, weId, (we) => ({ ...we, sets: we.sets.filter((s) => s.id !== setId) }));
}

export function moveExercise(w: ActiveWorkout, weId: string, dir: -1 | 1): ActiveWorkout {
  const i = w.exercises.findIndex((e) => e.id === weId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= w.exercises.length) return w;
  const ex = [...w.exercises];
  [ex[i], ex[j]] = [ex[j]!, ex[i]!];
  return { ...w, exercises: ex };
}

export function reorderExercises<T extends { id: string }>(list: T[], fromId: string, toId: string): T[] {
  const from = list.findIndex((e) => e.id === fromId);
  const to = list.findIndex((e) => e.id === toId);
  if (from < 0 || to < 0 || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

/** Vervang een oefening; ingevulde waarden blijven staan, het type-snapshot wordt aangepast. */
export function replaceExercise(w: ActiveWorkout, weId: string, ex: Exercise): ActiveWorkout {
  return updateExercise(w, weId, (we) => ({ ...we, exerciseId: ex.id, exerciseName: ex.name, exerciseType: ex.type }));
}

/** Koppel twee opeenvolgende oefeningen als superset (of ontkoppel). */
export function toggleSupersetWithNext<T extends { id: string; supersetGroup: string | null }>(list: T[], id: string): T[] {
  const i = list.findIndex((e) => e.id === id);
  const next = list[i + 1];
  const cur = list[i];
  if (!cur || !next) return list;
  if (cur.supersetGroup && cur.supersetGroup === next.supersetGroup) {
    // Ontkoppelen: de volgende oefening (en wat erop volgt in dezelfde groep) krijgt een nieuwe/geen groep.
    return list.map((e, k) => (k > i && e.supersetGroup === cur.supersetGroup ? { ...e, supersetGroup: null } : e)).map((e, k, arr) => {
      // Een groep van één is geen superset.
      const g = e.supersetGroup;
      if (!g) return e;
      return arr.filter((x) => x.supersetGroup === g).length < 2 ? { ...e, supersetGroup: null } : e;
    });
  }
  const group = cur.supersetGroup ?? next.supersetGroup ?? newId().slice(0, 8);
  return list.map((e, k) => (k === i || k === i + 1 ? { ...e, supersetGroup: group } : e));
}

/** Volgende niet-afgevinkte set na (weId, setId), voor de focus na afvinken. */
export function nextOpenSet(w: ActiveWorkout, weId: string, setId: string): { weId: string; setId: string } | null {
  let passed = false;
  for (const we of w.exercises) {
    for (const s of we.sets) {
      if (passed && !s.completed) return { weId: we.id, setId: s.id };
      if (we.id === weId && s.id === setId) passed = true;
    }
  }
  return null;
}

export function countSets(w: Pick<ActiveWorkout, 'exercises'>): { done: number; open: number } {
  let done = 0;
  let open = 0;
  for (const we of w.exercises) for (const s of we.sets) s.completed ? done++ : open++;
  return { done, open };
}

/** Maak van de actieve workout een afgeronde workout. */
export function toFinishedWorkout(a: ActiveWorkout, opts: { keepUnchecked: boolean; note: string | null }, now: Date): Workout {
  const exercises = a.exercises
    .map((we) => ({ ...we, sets: opts.keepUnchecked ? we.sets : we.sets.filter((s) => s.completed) }))
    .filter((we) => we.sets.length > 0);
  const effectiveNow = a.pausedAt ? new Date(a.pausedAt) : now;
  return {
    id: a.id,
    name: a.name.trim() || 'Workout',
    startedAt: a.startedAt,
    endedAt: toLocalIso(effectiveNow),
    durationSec: workoutElapsedSec(a, now.getTime()),
    note: opts.note,
    templateId: a.templateId,
    source: 'app',
    sourceKey: null,
    exercises,
    serverUpdatedAt: null,
    deletedAt: null,
  };
}

/**
 * Wijkt de workout af van de template? (andere oefeningen, volgorde of aantal sets)
 * Dan vragen we bij Finish of de template bijgewerkt moet worden.
 */
export function differsFromTemplate(w: Pick<Workout, 'exercises'>, t: Template): boolean {
  const a = w.exercises.map((e) => `${e.exerciseId}:${e.sets.length}:${e.supersetGroup ? 's' : ''}`);
  const b = t.exercises.map((e) => `${e.exerciseId}:${e.sets.length}:${e.supersetGroup ? 's' : ''}`);
  return a.join('|') !== b.join('|');
}

/** Template bijwerken met de structuur en waarden van deze workout (ids van de template blijven waar mogelijk). */
export function templateFromWorkout(t: Template, w: Pick<Workout, 'exercises'>): Template {
  const exercises: TemplateExercise[] = w.exercises
    .filter((we) => we.exerciseId)
    .map((we, i) => {
      const old = t.exercises[i]?.exerciseId === we.exerciseId ? t.exercises[i] : undefined;
      return {
        id: old?.id ?? newId(),
        exerciseId: we.exerciseId!,
        supersetGroup: we.supersetGroup,
        restSec: we.restSec,
        note: we.note,
        sets: we.sets.map((s, j) => ({
          id: old?.sets[j]?.id ?? newId(),
          type: s.type,
          reps: s.reps,
          weightKg: s.weightKg,
          durationSec: s.durationSec,
          distanceM: s.distanceM,
        })),
      };
    });
  return { ...t, exercises };
}

export function newTemplateFromWorkout(w: Pick<Workout, 'exercises' | 'name'>): Template {
  return templateFromWorkout(
    { id: newId(), name: w.name, folder: null, note: null, sortOrder: 0, exercises: [], serverUpdatedAt: null, deletedAt: null },
    w,
  );
}
