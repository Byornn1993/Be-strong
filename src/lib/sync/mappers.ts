import { z } from 'zod';
import {
  EQUIPMENT,
  EXERCISE_TYPES,
  GOAL_KINDS,
  MUSCLES,
  SET_TYPES,
  WIDGET_KINDS,
  type DashboardWidget,
  type Exercise,
  type ExercisePref,
  type Goal,
  type Measurement,
  type MeasurementType,
  type Profile,
  type Template,
  type Workout,
} from '@/lib/db/types';

// Vertaling tussen het lokale documentmodel (camelCase, genest) en de Supabase-tabellen (snake_case,
// genormaliseerd). Binnenkomende rijen worden met Zod gevalideerd.

const ts = z.string();
const nullableNum = z.coerce.number().nullable();
const optNum = z
  .union([z.number(), z.string()])
  .nullable()
  .transform((v) => (v === null ? null : Number(v)));

// ───────────── exercises
export const remoteExercise = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid().nullable(),
  name: z.string(),
  primary_muscle: z.enum(MUSCLES),
  secondary_muscles: z.array(z.enum(MUSCLES)).default([]),
  equipment: z.enum(EQUIPMENT),
  type: z.enum(EXERCISE_TYPES),
  instructions: z.string().nullable(),
  image_path: z.string().nullable(),
  notes: z.string().nullable(),
  updated_at: ts,
  deleted_at: ts.nullable(),
});
export const exerciseFromRemote = (r: z.infer<typeof remoteExercise>): Exercise => ({
  id: r.id,
  userId: r.user_id,
  name: r.name,
  primaryMuscle: r.primary_muscle,
  secondaryMuscles: r.secondary_muscles,
  equipment: r.equipment,
  type: r.type,
  instructions: r.instructions,
  imagePath: r.image_path,
  notes: r.notes,
  serverUpdatedAt: r.updated_at,
  deletedAt: r.deleted_at,
});
export const exerciseToRemote = (e: Exercise, userId: string) => ({
  id: e.id,
  user_id: userId,
  name: e.name,
  primary_muscle: e.primaryMuscle,
  secondary_muscles: e.secondaryMuscles,
  equipment: e.equipment,
  type: e.type,
  instructions: e.instructions,
  image_path: e.imagePath,
  notes: e.notes,
  deleted_at: e.deletedAt,
});

// ───────────── exercise prefs
export const remoteExercisePref = z.object({
  id: z.string().uuid(),
  exercise_id: z.string().uuid(),
  notes: z.string().nullable(),
  rest_sec: z.number().nullable(),
  updated_at: ts,
  deleted_at: ts.nullable(),
});
export const exercisePrefFromRemote = (r: z.infer<typeof remoteExercisePref>): ExercisePref => ({
  id: r.id,
  exerciseId: r.exercise_id,
  notes: r.notes,
  restSec: r.rest_sec,
  serverUpdatedAt: r.updated_at,
  deletedAt: r.deleted_at,
});
export const exercisePrefToRemote = (p: ExercisePref, userId: string) => ({
  id: p.id,
  user_id: userId,
  exercise_id: p.exerciseId,
  notes: p.notes,
  rest_sec: p.restSec,
  deleted_at: p.deletedAt,
});

// ───────────── workouts (aggregaat)
const remoteWorkoutSet = z.object({
  id: z.string().uuid(),
  position: z.number(),
  set_type: z.enum(SET_TYPES),
  weight_kg: optNum,
  reps: z.number().nullable(),
  duration_sec: z.number().nullable(),
  distance_m: optNum,
  rpe: optNum,
  completed: z.boolean(),
  completed_at: ts.nullable(),
  note: z.string().nullable(),
});
const remoteWorkoutExercise = z.object({
  id: z.string().uuid(),
  exercise_id: z.string().uuid().nullable(),
  exercise_name: z.string(),
  exercise_type: z.enum(EXERCISE_TYPES),
  position: z.number(),
  superset_group: z.string().nullable(),
  rest_sec: z.number().nullable(),
  note: z.string().nullable(),
  workout_sets: z.array(remoteWorkoutSet).default([]),
});
export const remoteWorkout = z.object({
  id: z.string().uuid(),
  name: z.string(),
  started_at: ts,
  ended_at: ts.nullable(),
  duration_sec: z.number(),
  note: z.string().nullable(),
  template_id: z.string().uuid().nullable(),
  source: z.enum(['app', 'strong_import']),
  source_key: z.string().nullable(),
  updated_at: ts,
  deleted_at: ts.nullable(),
  workout_exercises: z.array(remoteWorkoutExercise).default([]),
});
export const WORKOUT_SELECT = '*, workout_exercises(*, workout_sets(*))';

export const workoutFromRemote = (r: z.infer<typeof remoteWorkout>): Workout => ({
  id: r.id,
  name: r.name,
  startedAt: r.started_at,
  endedAt: r.ended_at,
  durationSec: r.duration_sec,
  note: r.note,
  templateId: r.template_id,
  source: r.source,
  sourceKey: r.source_key,
  serverUpdatedAt: r.updated_at,
  deletedAt: r.deleted_at,
  exercises: [...r.workout_exercises]
    .sort((a, b) => a.position - b.position)
    .map((we) => ({
      id: we.id,
      exerciseId: we.exercise_id,
      exerciseName: we.exercise_name,
      exerciseType: we.exercise_type,
      supersetGroup: we.superset_group,
      restSec: we.rest_sec,
      note: we.note,
      sets: [...we.workout_sets]
        .sort((a, b) => a.position - b.position)
        .map((s) => ({
          id: s.id,
          type: s.set_type,
          weightKg: s.weight_kg,
          reps: s.reps,
          durationSec: s.duration_sec,
          distanceM: s.distance_m,
          rpe: s.rpe,
          completed: s.completed,
          completedAt: s.completed_at,
          note: s.note,
        })),
    })),
});

export const workoutToPayload = (w: Workout) => ({
  id: w.id,
  name: w.name,
  started_at: w.startedAt,
  ended_at: w.endedAt,
  duration_sec: Math.round(w.durationSec),
  note: w.note,
  template_id: w.templateId,
  source: w.source,
  source_key: w.sourceKey,
  deleted_at: w.deletedAt,
  exercises: w.exercises.map((we, i) => ({
    id: we.id,
    exercise_id: we.exerciseId,
    exercise_name: we.exerciseName,
    exercise_type: we.exerciseType,
    position: i,
    superset_group: we.supersetGroup,
    rest_sec: we.restSec,
    note: we.note,
    sets: we.sets.map((s, j) => ({
      id: s.id,
      position: j,
      set_type: s.type,
      weight_kg: s.weightKg,
      reps: s.reps,
      duration_sec: s.durationSec,
      distance_m: s.distanceM,
      rpe: s.rpe,
      completed: s.completed,
      completed_at: s.completedAt,
      note: s.note,
    })),
  })),
});

// ───────────── templates (aggregaat)
const remoteTemplateSet = z.object({
  id: z.string().uuid(),
  position: z.number(),
  set_type: z.enum(SET_TYPES),
  reps: z.number().nullable(),
  weight_kg: optNum,
  duration_sec: z.number().nullable(),
  distance_m: optNum,
});
const remoteTemplateExercise = z.object({
  id: z.string().uuid(),
  exercise_id: z.string().uuid(),
  position: z.number(),
  superset_group: z.string().nullable(),
  rest_sec: z.number().nullable(),
  note: z.string().nullable(),
  template_sets: z.array(remoteTemplateSet).default([]),
});
export const remoteTemplate = z.object({
  id: z.string().uuid(),
  name: z.string(),
  folder: z.string().nullable(),
  note: z.string().nullable(),
  sort_order: z.number(),
  updated_at: ts,
  deleted_at: ts.nullable(),
  template_exercises: z.array(remoteTemplateExercise).default([]),
});
export const TEMPLATE_SELECT = '*, template_exercises(*, template_sets(*))';

export const templateFromRemote = (r: z.infer<typeof remoteTemplate>): Template => ({
  id: r.id,
  name: r.name,
  folder: r.folder,
  note: r.note,
  sortOrder: r.sort_order,
  serverUpdatedAt: r.updated_at,
  deletedAt: r.deleted_at,
  exercises: [...r.template_exercises]
    .sort((a, b) => a.position - b.position)
    .map((te) => ({
      id: te.id,
      exerciseId: te.exercise_id,
      supersetGroup: te.superset_group,
      restSec: te.rest_sec,
      note: te.note,
      sets: [...te.template_sets]
        .sort((a, b) => a.position - b.position)
        .map((s) => ({
          id: s.id,
          type: s.set_type,
          reps: s.reps,
          weightKg: s.weight_kg,
          durationSec: s.duration_sec,
          distanceM: s.distance_m,
        })),
    })),
});

export const templateToPayload = (t: Template) => ({
  id: t.id,
  name: t.name,
  folder: t.folder,
  note: t.note,
  sort_order: t.sortOrder,
  deleted_at: t.deletedAt,
  exercises: t.exercises.map((te, i) => ({
    id: te.id,
    exercise_id: te.exerciseId,
    position: i,
    superset_group: te.supersetGroup,
    rest_sec: te.restSec,
    note: te.note,
    sets: te.sets.map((s, j) => ({
      id: s.id,
      position: j,
      set_type: s.type,
      reps: s.reps,
      weight_kg: s.weightKg,
      duration_sec: s.durationSec,
      distance_m: s.distanceM,
    })),
  })),
});

// ───────────── measurement types & measurements
export const remoteMeasurementType = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid().nullable(),
  key: z.string(),
  name: z.string(),
  unit: z.string(),
  kind: z.enum(['mass', 'percent', 'length', 'other']),
  sort_order: z.number(),
  updated_at: ts,
  deleted_at: ts.nullable(),
});
export const measurementTypeFromRemote = (r: z.infer<typeof remoteMeasurementType>): MeasurementType => ({
  id: r.id,
  userId: r.user_id,
  key: r.key,
  name: r.name,
  unit: r.unit,
  kind: r.kind,
  sortOrder: r.sort_order,
  serverUpdatedAt: r.updated_at,
  deletedAt: r.deleted_at,
});
export const measurementTypeToRemote = (t: MeasurementType, userId: string) => ({
  id: t.id,
  user_id: userId,
  key: t.key,
  name: t.name,
  unit: t.unit,
  kind: t.kind,
  sort_order: t.sortOrder,
  deleted_at: t.deletedAt,
});

export const remoteMeasurement = z.object({
  id: z.string().uuid(),
  type_id: z.string().uuid(),
  measured_at: ts,
  value: z.coerce.number(),
  unit: z.string(),
  note: z.string().nullable(),
  source: z.enum(['manual', 'device']),
  updated_at: ts,
  deleted_at: ts.nullable(),
});
export const measurementFromRemote = (r: z.infer<typeof remoteMeasurement>): Measurement => ({
  id: r.id,
  typeId: r.type_id,
  measuredAt: r.measured_at,
  value: r.value,
  unit: r.unit,
  note: r.note,
  source: r.source,
  serverUpdatedAt: r.updated_at,
  deletedAt: r.deleted_at,
});
export const measurementToRemote = (m: Measurement, userId: string) => ({
  id: m.id,
  user_id: userId,
  type_id: m.typeId,
  measured_at: m.measuredAt,
  value: m.value,
  unit: m.unit,
  note: m.note,
  source: m.source,
  deleted_at: m.deletedAt,
});

// ───────────── goals
export const remoteGoal = z.object({
  id: z.string().uuid(),
  kind: z.enum(GOAL_KINDS),
  title: z.string().nullable(),
  exercise_id: z.string().uuid().nullable(),
  start_value: nullableNum,
  target_value: z.coerce.number(),
  deadline: z.string().nullable(),
  completed_at: ts.nullable(),
  note: z.string().nullable(),
  updated_at: ts,
  deleted_at: ts.nullable(),
});
export const goalFromRemote = (r: z.infer<typeof remoteGoal>): Goal => ({
  id: r.id,
  kind: r.kind,
  title: r.title,
  exerciseId: r.exercise_id,
  startValue: r.start_value,
  targetValue: r.target_value,
  deadline: r.deadline,
  completedAt: r.completed_at,
  note: r.note,
  serverUpdatedAt: r.updated_at,
  deletedAt: r.deleted_at,
});
export const goalToRemote = (g: Goal, userId: string) => ({
  id: g.id,
  user_id: userId,
  kind: g.kind,
  title: g.title,
  exercise_id: g.exerciseId,
  start_value: g.startValue,
  target_value: g.targetValue,
  deadline: g.deadline,
  completed_at: g.completedAt,
  note: g.note,
  deleted_at: g.deletedAt,
});

// ───────────── dashboard widgets
export const remoteWidget = z.object({
  id: z.string().uuid(),
  kind: z.enum(WIDGET_KINDS),
  position: z.number(),
  config: z.record(z.unknown()).default({}),
  updated_at: ts,
  deleted_at: ts.nullable(),
});
export const widgetFromRemote = (r: z.infer<typeof remoteWidget>): DashboardWidget => ({
  id: r.id,
  kind: r.kind,
  position: r.position,
  config: r.config,
  serverUpdatedAt: r.updated_at,
  deletedAt: r.deleted_at,
});
export const widgetToRemote = (w: DashboardWidget, userId: string) => ({
  id: w.id,
  user_id: userId,
  kind: w.kind,
  position: w.position,
  config: w.config,
  deleted_at: w.deletedAt,
});

// ───────────── profile
export const remoteProfile = z.object({
  id: z.string().uuid(),
  display_name: z.string().nullable(),
  avatar_url: z.string().nullable(),
  weekly_workout_goal: z.number(),
  default_rest_sec: z.number(),
  updated_at: ts,
});
export const profileFromRemote = (r: z.infer<typeof remoteProfile>): Profile => ({
  id: r.id,
  displayName: r.display_name,
  avatarUrl: r.avatar_url,
  weeklyWorkoutGoal: r.weekly_workout_goal,
  defaultRestSec: r.default_rest_sec,
  serverUpdatedAt: r.updated_at,
});
export const profileToRemote = (p: Profile) => ({
  id: p.id,
  display_name: p.displayName,
  avatar_url: p.avatarUrl,
  weekly_workout_goal: p.weeklyWorkoutGoal,
  default_rest_sec: p.defaultRestSec,
});
