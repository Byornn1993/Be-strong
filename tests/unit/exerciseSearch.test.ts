import { describe, expect, it } from 'vitest';
import { filterExercises, isCardio } from '@/domain/exerciseSearch';
import type { Exercise } from '@/lib/db/types';
import standard from '@/data/exercises.json';

const all = (standard as Omit<Exercise, 'userId' | 'instructions' | 'imagePath' | 'notes' | 'serverUpdatedAt' | 'deletedAt'>[]).map(
  (e) => ({ ...e, userId: null, instructions: null, imagePath: null, notes: null, serverUpdatedAt: null, deletedAt: null }) as Exercise,
);
const names = (list: Exercise[]) => list.map((e) => e.name);

describe('oefeningen zoeken', () => {
  it('filter Cardio toont lopen, fietsen, roeien, wandelen en trap, maar geen plank', () => {
    const cardio = names(filterExercises(all, '', 'cardio'));
    for (const n of ['Running', 'Running (Treadmill)', 'Cycling', 'Cycling (Indoor)', 'Rowing (Machine)', 'Walking', 'Stair Climber (Machine)', 'Elliptical Trainer'])
      expect(cardio).toContain(n);
    expect(cardio).not.toContain('Plank');
    expect(cardio).not.toContain('Bench Press (Barbell)');
  });

  it('vindt cardio met Nederlandse woorden', () => {
    expect(names(filterExercises(all, 'fietsen', null))).toEqual(expect.arrayContaining(['Cycling', 'Cycling (Indoor)']));
    expect(names(filterExercises(all, 'roeien', null))).toContain('Rowing (Machine)');
    expect(names(filterExercises(all, 'lopen', null))).toEqual(expect.arrayContaining(['Running', 'Running (Treadmill)']));
    expect(names(filterExercises(all, 'wandelen', null))).toEqual(expect.arrayContaining(['Walking', 'Walking (Treadmill)']));
    expect(names(filterExercises(all, 'trap', null))).toContain('Stair Climber (Machine)');
    expect(names(filterExercises(all, 'cardio', null)).length).toBe(filterExercises(all, '', 'cardio').length);
  });

  it('zoeken op Engelse naam en spiergroep werkt zoals voorheen', () => {
    expect(names(filterExercises(all, 'bench dumbbell', null))).toContain('Bench Press (Dumbbell)');
    expect(filterExercises(all, '', 'chest').every((e) => e.primaryMuscle === 'chest' || e.secondaryMuscles.includes('chest'))).toBe(true);
    expect(isCardio({ type: 'duration', primaryMuscle: 'core' })).toBe(false);
  });
});
