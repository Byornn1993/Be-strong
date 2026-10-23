import type { ExerciseType, Workout, WorkoutSet } from '@/lib/db/types';

// Persoonlijke records (PR's). Definities — ook beschreven in docs/PRS.md:
//  * Alleen AFGEWERKTE sets, nooit warm-up-sets.
//  * Alleen binnen hetzelfde oefeningtype: historische sets tellen enkel mee als het type-snapshot
//    gelijk is aan het huidige type van de oefening (een type-wijziging start dus nieuwe records).
//  * heaviestWeight   — zwaarste gewicht (kg) in één set, met minstens 1 rep.
//  * repsAtWeight     — per gewicht: het hoogste aantal reps. Bij bodyweight_reps: sleutel 0.
//  * estimated1RM     — Epley: gewicht × (1 + reps/30), enkel voor sets van 1–12 reps. Dit is een SCHATTING.
//  * bestSetVolume    — grootste gewicht × reps in één set.
//  * bestSessionVolume— grootste som van gewicht × reps voor deze oefening binnen één workout.
//  * longestDuration  — langste tijd (duration / distance_duration).
//  * longestDistance  — langste afstand (distance_duration / weight_distance).
// Een "nieuw PR" bij Finish = strikt beter dan alles wat er vóór deze workout bestond, én er bestond al
// een eerdere waarde (de allereerste keer is een nulmeting, geen record).

export type PrKind =
  | 'heaviestWeight'
  | 'repsAtWeight'
  | 'estimated1RM'
  | 'bestSetVolume'
  | 'bestSessionVolume'
  | 'longestDuration'
  | 'longestDistance';

export const PR_LABELS: Record<PrKind, string> = {
  heaviestWeight: 'Zwaarste gewicht',
  repsAtWeight: 'Meeste reps',
  estimated1RM: 'Geschatte 1RM (schatting)',
  bestSetVolume: 'Grootste setvolume',
  bestSessionVolume: 'Grootste sessievolume',
  longestDuration: 'Langste tijd',
  longestDistance: 'Langste afstand',
};

export interface ExerciseRecords {
  heaviestWeight: number | null;
  repsAtWeight: Map<number, number>;
  estimated1RM: number | null;
  bestSetVolume: number | null;
  bestSessionVolume: number | null;
  longestDuration: number | null;
  longestDistance: number | null;
}

export interface NewPr {
  exerciseId: string | null;
  exerciseName: string;
  kind: PrKind;
  value: number;
  previous: number;
  /** Gewicht waarbij een reps-record hoort. */
  atWeight?: number;
}

export function epley(weightKg: number, reps: number): number | null {
  if (weightKg <= 0 || reps < 1 || reps > 12) return null;
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30);
}

const usesWeight = (t: ExerciseType) => t === 'weight_reps' || t === 'weighted_bodyweight' || t === 'weight_distance';
const usesVolume = (t: ExerciseType) => t === 'weight_reps' || t === 'weighted_bodyweight';

function emptyRecords(): ExerciseRecords {
  return {
    heaviestWeight: null,
    repsAtWeight: new Map(),
    estimated1RM: null,
    bestSetVolume: null,
    bestSessionVolume: null,
    longestDuration: null,
    longestDistance: null,
  };
}

const max = (a: number | null, b: number | null) => (a === null ? b : b === null ? a : Math.max(a, b));

function eligible(s: WorkoutSet): boolean {
  return s.completed && s.type !== 'warmup';
}

/** Records van één workout voor één oefening. */
function recordsFromSets(type: ExerciseType, sets: WorkoutSet[]): ExerciseRecords {
  const r = emptyRecords();
  let session = 0;
  for (const s of sets) {
    if (!eligible(s)) continue;
    const w = s.weightKg ?? 0;
    const reps = s.reps ?? 0;
    if (usesWeight(type) && w > 0 && (type === 'weight_distance' || reps >= 1)) r.heaviestWeight = max(r.heaviestWeight, w);
    if ((usesVolume(type) || type === 'bodyweight_reps') && reps > 0) {
      const key = type === 'bodyweight_reps' ? 0 : w;
      r.repsAtWeight.set(key, Math.max(r.repsAtWeight.get(key) ?? 0, reps));
    }
    if (type === 'weight_reps') r.estimated1RM = max(r.estimated1RM, epley(w, reps));
    if (usesVolume(type) && w > 0 && reps > 0) {
      r.bestSetVolume = max(r.bestSetVolume, w * reps);
      session += w * reps;
    }
    if ((type === 'duration' || type === 'distance_duration') && (s.durationSec ?? 0) > 0)
      r.longestDuration = max(r.longestDuration, s.durationSec);
    if ((type === 'distance_duration' || type === 'weight_distance') && (s.distanceM ?? 0) > 0)
      r.longestDistance = max(r.longestDistance, s.distanceM);
  }
  if (session > 0) r.bestSessionVolume = session;
  return r;
}

function merge(a: ExerciseRecords, b: ExerciseRecords): ExerciseRecords {
  const reps = new Map(a.repsAtWeight);
  for (const [k, v] of b.repsAtWeight) reps.set(k, Math.max(reps.get(k) ?? 0, v));
  return {
    heaviestWeight: max(a.heaviestWeight, b.heaviestWeight),
    repsAtWeight: reps,
    estimated1RM: max(a.estimated1RM, b.estimated1RM),
    bestSetVolume: max(a.bestSetVolume, b.bestSetVolume),
    bestSessionVolume: max(a.bestSessionVolume, b.bestSessionVolume),
    longestDuration: max(a.longestDuration, b.longestDuration),
    longestDistance: max(a.longestDistance, b.longestDistance),
  };
}

export interface ExerciseKey {
  exerciseId: string | null;
  exerciseName: string;
  type: ExerciseType;
}

function sameExercise(we: { exerciseId: string | null; exerciseName: string }, key: ExerciseKey) {
  if (key.exerciseId && we.exerciseId) return we.exerciseId === key.exerciseId;
  return we.exerciseName.trim().toLowerCase() === key.exerciseName.trim().toLowerCase();
}

/** Alle records van een oefening over de opgegeven workouts (optioneel enkel vóór een tijdstip). */
export function computeRecords(workouts: readonly Workout[], key: ExerciseKey, beforeIso?: string): ExerciseRecords {
  const before = beforeIso ? new Date(beforeIso).getTime() : Infinity;
  let acc = emptyRecords();
  for (const w of workouts) {
    if (w.deletedAt || new Date(w.startedAt).getTime() >= before) continue;
    const sets = w.exercises.filter((we) => sameExercise(we, key) && we.exerciseType === key.type).flatMap((we) => we.sets);
    if (sets.length) acc = merge(acc, recordsFromSets(key.type, sets));
  }
  return acc;
}

/** Nieuwe PR's die een (afgeronde of lopende) workout zet t.o.v. alle eerdere workouts. */
export function detectNewPrs(workout: Pick<Workout, 'startedAt' | 'exercises'>, history: readonly Workout[]): NewPr[] {
  const out: NewPr[] = [];
  const seen = new Set<string>();
  for (const we of workout.exercises) {
    const key: ExerciseKey = { exerciseId: we.exerciseId, exerciseName: we.exerciseName, type: we.exerciseType };
    const dedupe = `${we.exerciseId ?? we.exerciseName}|${we.exerciseType}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);

    const prev = computeRecords(history, key, workout.startedAt);
    const sets = workout.exercises.filter((x) => sameExercise(x, key) && x.exerciseType === key.type).flatMap((x) => x.sets);
    const now = recordsFromSets(key.type, sets);
    const base = { exerciseId: we.exerciseId, exerciseName: we.exerciseName };

    const scalar: PrKind[] = ['heaviestWeight', 'estimated1RM', 'bestSetVolume', 'bestSessionVolume', 'longestDuration', 'longestDistance'];
    for (const kind of scalar) {
      const p = prev[kind] as number | null;
      const n = now[kind] as number | null;
      if (p !== null && n !== null && n > p + 1e-9) out.push({ ...base, kind, value: n, previous: p });
    }
    for (const [weight, reps] of now.repsAtWeight) {
      const p = prev.repsAtWeight.get(weight);
      if (p !== undefined && reps > p) out.push({ ...base, kind: 'repsAtWeight', value: reps, previous: p, atWeight: weight });
    }
  }
  return out;
}
