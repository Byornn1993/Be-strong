import type { Workout, WorkoutSet } from '@/lib/db/types';
import { epley } from './prs';

export interface ExerciseSession {
  workoutId: string;
  workoutName: string;
  startedAt: string;
  sets: WorkoutSet[];
  heaviest: number | null;
  e1rm: number | null;
  volume: number;
}

/** Alle sessies (nieuwste eerst) waarin een oefening voorkwam, met kerncijfers per sessie. */
export function exerciseSessions(workouts: readonly Workout[], exerciseId: string): ExerciseSession[] {
  const out: ExerciseSession[] = [];
  for (const w of workouts) {
    if (w.deletedAt) continue;
    const wes = w.exercises.filter((we) => we.exerciseId === exerciseId);
    if (!wes.length) continue;
    const sets = wes.flatMap((we) => we.sets.filter((s) => s.completed));
    if (!sets.length) continue;
    const working = sets.filter((s) => s.type !== 'warmup');
    const type = wes[0]!.exerciseType;
    const weighted = type === 'weight_reps' || type === 'weighted_bodyweight';
    let heaviest: number | null = null;
    let e1rm: number | null = null;
    let volume = 0;
    for (const s of working) {
      if (weighted && (s.weightKg ?? 0) > 0) heaviest = Math.max(heaviest ?? 0, s.weightKg!);
      if (type === 'weight_reps') {
        const e = epley(s.weightKg ?? 0, s.reps ?? 0);
        if (e !== null) e1rm = Math.max(e1rm ?? 0, e);
      }
    }
    if (weighted) for (const s of sets) volume += (s.weightKg ?? 0) * (s.reps ?? 0);
    out.push({ workoutId: w.id, workoutName: w.name, startedAt: w.startedAt, sets, heaviest, e1rm, volume });
  }
  return out.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
