import type { Exercise, Goal, Measurement, Workout } from '@/lib/db/types';
import { computeRecords } from './prs';
import { streakWeeks, workoutsThisWeek } from './stats';

export interface GoalProgress {
  current: number | null;
  /** 0..1 */
  ratio: number;
  label: string;
  done: boolean;
}

export const GOAL_LABELS: Record<Goal['kind'], string> = {
  bodyweight: 'Lichaamsgewicht',
  workouts_per_week: 'Workouts per week',
  exercise_weight: 'Gewicht voor een oefening',
  exercise_reps: 'Reps voor een oefening',
  streak: 'Streak (weken)',
};

const clamp = (n: number) => Math.min(1, Math.max(0, n));

/** Voortgang van een doel, berekend uit echte data. */
export function goalProgress(
  g: Goal,
  ctx: { workouts: readonly Workout[]; measurements: readonly Measurement[]; bodyweightTypeId: string; exercises: ReadonlyMap<string, Exercise>; now: Date },
): GoalProgress {
  switch (g.kind) {
    case 'bodyweight': {
      const bw = ctx.measurements.filter((m) => m.typeId === ctx.bodyweightTypeId && !m.deletedAt).sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
      const current = bw.at(-1)?.value ?? null;
      const start = g.startValue ?? bw[0]?.value ?? null;
      if (current === null || start === null) return { current, ratio: 0, label: 'Nog geen gewicht gemeten', done: false };
      const total = start - g.targetValue;
      const ratio = total === 0 ? 1 : clamp((start - current) / total);
      return { current, ratio, label: `${current} kg → ${g.targetValue} kg`, done: total >= 0 ? current <= g.targetValue : current >= g.targetValue };
    }
    case 'workouts_per_week': {
      const n = workoutsThisWeek(ctx.workouts, ctx.now).length;
      return { current: n, ratio: clamp(n / g.targetValue), label: `${n} van ${g.targetValue} deze week`, done: n >= g.targetValue };
    }
    case 'streak': {
      const n = streakWeeks(ctx.workouts, ctx.now);
      return { current: n, ratio: clamp(n / g.targetValue), label: `${n} van ${g.targetValue} weken`, done: n >= g.targetValue };
    }
    case 'exercise_weight':
    case 'exercise_reps': {
      const ex = g.exerciseId ? ctx.exercises.get(g.exerciseId) : undefined;
      if (!ex) return { current: null, ratio: 0, label: 'Oefening niet gevonden', done: false };
      const r = computeRecords(ctx.workouts, { exerciseId: ex.id, exerciseName: ex.name, type: ex.type });
      const current = g.kind === 'exercise_weight' ? r.heaviestWeight : Math.max(0, ...r.repsAtWeight.values());
      const unit = g.kind === 'exercise_weight' ? 'kg' : 'reps';
      return {
        current,
        ratio: clamp((current ?? 0) / g.targetValue),
        label: `${ex.name}: ${current ?? 0} / ${g.targetValue} ${unit}`,
        done: (current ?? 0) >= g.targetValue,
      };
    }
  }
}
