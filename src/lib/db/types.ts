// Domeinmodel zoals de app het lokaal (IndexedDB) bewaart.
// Workouts en templates zijn "documenten" met geneste oefeningen en sets; in Supabase zijn
// ze genormaliseerd over meerdere tabellen (zie lib/sync/mappers.ts).

export const MUSCLES = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'legs', 'glutes', 'core', 'calves', 'full_body'] as const;
export type Muscle = (typeof MUSCLES)[number];

export const EQUIPMENT = ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'kettlebell', 'plate_loaded', 'other'] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const EXERCISE_TYPES = [
  'weight_reps',
  'bodyweight_reps',
  'weighted_bodyweight',
  'assisted_bodyweight',
  'duration',
  'distance_duration',
  'weight_distance',
] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number];

export const SET_TYPES = ['normal', 'warmup', 'drop', 'failure'] as const;
export type SetType = (typeof SET_TYPES)[number];

/** Velden die elk gesynchroniseerd record heeft. */
export interface SyncMeta {
  /** updated_at zoals de server het laatst bevestigde; null = nog nooit gesynchroniseerd. */
  serverUpdatedAt: string | null;
  deletedAt: string | null;
}

export interface Exercise extends SyncMeta {
  id: string;
  userId: string | null; // null = standaardoefening
  name: string;
  primaryMuscle: Muscle;
  secondaryMuscles: Muscle[];
  equipment: Equipment;
  type: ExerciseType;
  instructions: string | null;
  imagePath: string | null;
  notes: string | null;
}

export interface ExercisePref extends SyncMeta {
  id: string;
  exerciseId: string;
  notes: string | null;
  restSec: number | null;
}

export interface SetValues {
  weightKg: number | null;
  reps: number | null;
  durationSec: number | null;
  distanceM: number | null;
}

export interface WorkoutSet extends SetValues {
  id: string;
  type: SetType;
  rpe: number | null;
  completed: boolean;
  completedAt: string | null;
  note: string | null;
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string | null;
  /** Snapshot: naam en type op het moment van de workout. */
  exerciseName: string;
  exerciseType: ExerciseType;
  supersetGroup: string | null;
  restSec: number | null;
  note: string | null;
  sets: WorkoutSet[];
}

export interface Workout extends SyncMeta {
  id: string;
  name: string;
  /** ISO-timestamp met tijdzone-offset. */
  startedAt: string;
  endedAt: string | null;
  durationSec: number;
  note: string | null;
  templateId: string | null;
  source: 'app' | 'strong_import';
  sourceKey: string | null;
  exercises: WorkoutExercise[];
}

export interface TemplateSet {
  id: string;
  type: SetType;
  reps: number | null;
  weightKg: number | null;
  durationSec: number | null;
  distanceM: number | null;
}

export interface TemplateExercise {
  id: string;
  exerciseId: string;
  supersetGroup: string | null;
  restSec: number | null;
  note: string | null;
  sets: TemplateSet[];
}

export interface Template extends SyncMeta {
  id: string;
  name: string;
  folder: string | null;
  note: string | null;
  sortOrder: number;
  exercises: TemplateExercise[];
}

export type MeasurementKind = 'mass' | 'percent' | 'length' | 'other';

export interface MeasurementType extends SyncMeta {
  id: string;
  userId: string | null;
  key: string;
  name: string;
  unit: string;
  kind: MeasurementKind;
  sortOrder: number;
}

export interface Measurement extends SyncMeta {
  id: string;
  typeId: string;
  measuredAt: string;
  value: number;
  unit: string;
  note: string | null;
  source: 'manual' | 'device';
}

export const GOAL_KINDS = ['bodyweight', 'workouts_per_week', 'exercise_weight', 'exercise_reps', 'streak'] as const;
export type GoalKind = (typeof GOAL_KINDS)[number];

export interface Goal extends SyncMeta {
  id: string;
  kind: GoalKind;
  title: string | null;
  exerciseId: string | null;
  startValue: number | null;
  targetValue: number;
  deadline: string | null; // yyyy-mm-dd
  completedAt: string | null;
  note: string | null;
}

export const WIDGET_KINDS = [
  'workouts_per_week',
  'volume_per_week',
  'time_this_week',
  'workouts_this_month',
  'last_workout',
  'recent_prs',
  'bodyweight',
  'goals',
] as const;
export type WidgetKind = (typeof WIDGET_KINDS)[number];

export interface DashboardWidget extends SyncMeta {
  id: string;
  kind: WidgetKind;
  position: number;
  config: Record<string, unknown>;
}

export interface Profile {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  weeklyWorkoutGoal: number;
  defaultRestSec: number;
  serverUpdatedAt: string | null;
}

/** De lopende workout. Wordt bij elke wijziging lokaal bewaard (herstel na refresh/crash). */
export interface ActiveWorkout {
  id: string;
  name: string;
  startedAt: string;
  templateId: string | null;
  note: string | null;
  exercises: WorkoutExercise[];
  /** Gepauzeerd sinds (ISO) of null. */
  pausedAt: string | null;
  /** Totale pauzeduur in ms, exclusief een lopende pauze. */
  pausedMs: number;
  rest: RestTimerState | null;
  /** Wordt gezet zodra Finish start; voorkomt dubbel afronden. */
  finishing: boolean;
}

export interface RestTimerState {
  /** Epoch-ms waarop de rust afloopt. De resterende tijd wordt altijd hieruit berekend. */
  endsAt: number;
  totalSec: number;
  workoutExerciseId: string | null;
  /** Set waarna de rustbalk getoond wordt. */
  afterSetId?: string | null;
}
