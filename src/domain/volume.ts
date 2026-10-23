import type { ExerciseType, Workout, WorkoutExercise, WorkoutSet } from '@/lib/db/types';
import { countsWeight } from './exerciseTypes';

// Volume = gewicht × reps van AFGEWERKTE sets, inclusief warm-ups (zoals in Strong).
// Alleen voor types met een (extra) gewicht en reps: weight_reps en weighted_bodyweight.
// Bodyweight-, assisted-, tijd- en afstandsoefeningen hebben volume 0.

export function setVolume(type: ExerciseType, s: Pick<WorkoutSet, 'weightKg' | 'reps' | 'completed'>): number {
  if (!s.completed) return 0;
  if (type !== 'weight_reps' && type !== 'weighted_bodyweight') return 0;
  return (s.weightKg ?? 0) * (s.reps ?? 0);
}

export function exerciseVolume(we: WorkoutExercise): number {
  return we.sets.reduce((sum, s) => sum + setVolume(we.exerciseType, s), 0);
}

export function workoutVolume(w: Workout): number {
  return w.exercises.reduce((sum, we) => sum + exerciseVolume(we), 0);
}

export function completedSetCount(w: Pick<Workout, 'exercises'>): number {
  return w.exercises.reduce((n, we) => n + we.sets.filter((s) => s.completed).length, 0);
}

/** Beste set van een oefening binnen een workout (voor de History-lijst). */
export function bestSet(we: WorkoutExercise): WorkoutSet | null {
  const done = we.sets.filter((s) => s.completed && s.type !== 'warmup');
  if (done.length === 0) return null;
  const score = (s: WorkoutSet) => {
    if (countsWeight(we.exerciseType)) return (s.weightKg ?? 0) * 10000 + (s.reps ?? 0) + (s.distanceM ?? 0) / 1e6;
    if (we.exerciseType === 'assisted_bodyweight') return (s.reps ?? 0) * 10000 - (s.weightKg ?? 0);
    if (we.exerciseType === 'duration') return s.durationSec ?? 0;
    if (we.exerciseType === 'distance_duration') return (s.distanceM ?? 0) * 100000 + (s.durationSec ?? 0);
    return s.reps ?? 0;
  };
  return done.reduce((a, b) => (score(b) > score(a) ? b : a));
}
