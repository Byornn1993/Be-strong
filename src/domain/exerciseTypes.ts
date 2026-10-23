import type { Equipment, ExerciseType, Muscle, SetType, SetValues } from '@/lib/db/types';

export type SetField = 'weightKg' | 'reps' | 'durationSec' | 'distanceM';

export interface ColumnDef {
  field: SetField;
  label: string;
}

/** Welke kolommen een set van dit type registreert (in de volgorde van de tabel). */
export function columnsFor(type: ExerciseType): ColumnDef[] {
  switch (type) {
    case 'weight_reps':
      return [{ field: 'weightKg', label: 'kg' }, { field: 'reps', label: 'Reps' }];
    case 'bodyweight_reps':
      return [{ field: 'reps', label: 'Reps' }];
    case 'weighted_bodyweight':
      return [{ field: 'weightKg', label: '+kg' }, { field: 'reps', label: 'Reps' }];
    case 'assisted_bodyweight':
      return [{ field: 'weightKg', label: '−kg' }, { field: 'reps', label: 'Reps' }];
    case 'duration':
      return [{ field: 'durationSec', label: 'Tijd' }];
    case 'distance_duration':
      return [{ field: 'distanceM', label: 'm' }, { field: 'durationSec', label: 'Tijd' }];
    case 'weight_distance':
      return [{ field: 'weightKg', label: 'kg' }, { field: 'distanceM', label: 'm' }];
  }
}

/** Gebruikt dit type een (extra) gewicht dat in volume en gewicht-PR's meetelt? */
export function countsWeight(type: ExerciseType): boolean {
  return type === 'weight_reps' || type === 'weighted_bodyweight' || type === 'weight_distance';
}

/** Is een set "ingevuld" genoeg om af te vinken? */
export function hasValues(type: ExerciseType, v: SetValues): boolean {
  return columnsFor(type).some((c) => (v[c.field] ?? 0) > 0);
}

export const MUSCLE_LABELS: Record<Muscle, string> = {
  chest: 'Borst',
  back: 'Rug',
  shoulders: 'Schouders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  legs: 'Benen',
  glutes: 'Billen',
  core: 'Core',
  calves: 'Kuiten',
  full_body: 'Full body',
};

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  cable: 'Cable',
  machine: 'Machine',
  bodyweight: 'Lichaamsgewicht',
  kettlebell: 'Kettlebell',
  plate_loaded: 'Plate loaded',
  other: 'Overig',
};

export const TYPE_LABELS: Record<ExerciseType, string> = {
  weight_reps: 'Gewicht × reps',
  bodyweight_reps: 'Reps (lichaamsgewicht)',
  weighted_bodyweight: 'Extra gewicht × reps',
  assisted_bodyweight: 'Assistentie × reps',
  duration: 'Tijd',
  distance_duration: 'Afstand + tijd',
  weight_distance: 'Gewicht + afstand',
};

export const SET_TYPE_LABELS: Record<SetType, string> = {
  normal: 'Normaal',
  warmup: 'Warm-up',
  drop: 'Drop set',
  failure: 'Failure',
};

/** Korte badge in de Set-kolom: W, D, F of het setnummer. */
export function setBadge(type: SetType, normalIndex: number): string {
  if (type === 'warmup') return 'W';
  if (type === 'drop') return 'D';
  if (type === 'failure') return 'F';
  return String(normalIndex);
}
