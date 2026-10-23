import type { SetValues, Workout, WorkoutExercise, WorkoutSet } from '@/lib/db/types';

// "Previous" = de set met hetzelfde nummer uit de laatste keer dat ik deze oefening deed.
// Definitie:
//  * We zoeken de meest recente workout (startedAt < start van de huidige workout, niet verwijderd)
//    die deze oefening bevat. Match op exerciseId; als dat ontbreekt (bv. verwijderde oefening) op naam.
//  * Daarvan nemen we de afgewerkte sets (completed), in volgorde.
//  * Set N van nu krijgt afgewerkte set N van toen. Is er geen set N, dan is er geen Previous.

export interface ExerciseRef {
  exerciseId: string | null;
  exerciseName: string;
}

function matches(we: WorkoutExercise, ref: ExerciseRef): boolean {
  if (ref.exerciseId && we.exerciseId) return we.exerciseId === ref.exerciseId;
  return we.exerciseName.trim().toLowerCase() === ref.exerciseName.trim().toLowerCase();
}

/** Afgewerkte sets van de vorige keer, of [] als de oefening nog nooit gedaan is. */
export function findPreviousSets(workouts: readonly Workout[], ref: ExerciseRef, beforeIso: string): WorkoutSet[] {
  const before = new Date(beforeIso).getTime();
  let best: { t: number; sets: WorkoutSet[] } | null = null;
  for (const w of workouts) {
    if (w.deletedAt) continue;
    const t = new Date(w.startedAt).getTime();
    if (t >= before) continue;
    if (best && t <= best.t) continue;
    // Binnen één workout kan een oefening meermaals voorkomen; we voegen de sets samen in volgorde.
    const sets = w.exercises.filter((we) => matches(we, ref)).flatMap((we) => we.sets.filter((s) => s.completed));
    if (sets.length > 0) best = { t, sets };
  }
  return best?.sets ?? [];
}

export function previousForIndex(previous: readonly WorkoutSet[], index: number): SetValues | null {
  const s = previous[index];
  if (!s) return null;
  return { weightKg: s.weightKg, reps: s.reps, durationSec: s.durationSec, distanceM: s.distanceM };
}
