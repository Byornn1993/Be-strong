import type { Exercise, ExerciseType, SetType, Workout, WorkoutSet } from '@/lib/db/types';
import standard from '@/data/exercises.json';

let n = 0;
const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;

export const library: Exercise[] = standard.map((e) => ({
  ...(e as Omit<Exercise, 'userId' | 'instructions' | 'imagePath' | 'notes' | 'serverUpdatedAt' | 'deletedAt'>),
  userId: null,
  instructions: null,
  imagePath: null,
  notes: null,
  serverUpdatedAt: null,
  deletedAt: null,
}));

export const exByName = (name: string) => {
  const e = library.find((x) => x.name === name);
  if (!e) throw new Error(`niet in bibliotheek: ${name}`);
  return e;
};

export function set(weightKg: number | null, reps: number | null, opts: Partial<WorkoutSet> & { type?: SetType } = {}): WorkoutSet {
  return { id: id(), type: 'normal', weightKg, reps, durationSec: null, distanceM: null, rpe: null, completed: true, completedAt: null, note: null, ...opts };
}

export function workout(startedAt: string, exercises: { name: string; type?: ExerciseType; sets: WorkoutSet[] }[], extra: Partial<Workout> = {}): Workout {
  return {
    id: id(),
    name: 'W',
    startedAt,
    endedAt: null,
    durationSec: 3600,
    note: null,
    templateId: null,
    source: 'app',
    sourceKey: null,
    serverUpdatedAt: null,
    deletedAt: null,
    exercises: exercises.map((e) => {
      const ex = library.find((x) => x.name === e.name);
      return {
        id: id(),
        exerciseId: ex?.id ?? null,
        exerciseName: e.name,
        exerciseType: e.type ?? ex?.type ?? 'weight_reps',
        supersetGroup: null,
        restSec: null,
        note: null,
        sets: e.sets,
      };
    }),
    ...extra,
  };
}
