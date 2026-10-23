import type { Workout } from '@/lib/db/types';
import { addDays, dayKey, monthKey, startOfWeek, weekKey } from './dates';
import { completedSetCount, workoutVolume } from './volume';

// Statistieken, allemaal berekend uit opgeslagen workouts. Verwijderde workouts tellen nooit mee.

export const alive = (ws: readonly Workout[]) => ws.filter((w) => !w.deletedAt);

export interface WeekBucket {
  weekStart: string; // yyyy-mm-dd (maandag)
  count: number;
  volume: number;
  durationSec: number;
}

/** De laatste `weeks` weken (oudste eerst), inclusief de huidige week. */
export function weeklyBuckets(workouts: readonly Workout[], weeks: number, now: Date): WeekBucket[] {
  const current = startOfWeek(now);
  const buckets = new Map<string, WeekBucket>();
  for (let i = weeks - 1; i >= 0; i--) {
    const k = dayKey(addDays(current, -7 * i));
    buckets.set(k, { weekStart: k, count: 0, volume: 0, durationSec: 0 });
  }
  for (const w of alive(workouts)) {
    const b = buckets.get(weekKey(w.startedAt));
    if (!b) continue;
    b.count += 1;
    b.volume += workoutVolume(w);
    b.durationSec += w.durationSec;
  }
  return [...buckets.values()];
}

/**
 * Streak in weken: het aantal opeenvolgende weken (ma–zo) met minstens `minPerWeek` workouts.
 * De huidige week telt mee als het doel al gehaald is; anders breekt een lopende week de streak niet
 * (de week is nog niet voorbij) en tellen we vanaf vorige week.
 */
export function streakWeeks(workouts: readonly Workout[], now: Date, minPerWeek = 1): number {
  const counts = new Map<string, number>();
  for (const w of alive(workouts)) {
    const k = weekKey(w.startedAt);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let week = startOfWeek(now);
  let streak = 0;
  if ((counts.get(dayKey(week)) ?? 0) >= minPerWeek) streak = 1;
  week = addDays(week, -7);
  while ((counts.get(dayKey(week)) ?? 0) >= minPerWeek) {
    streak += 1;
    week = addDays(week, -7);
  }
  return streak;
}

export function workoutsInMonth(workouts: readonly Workout[], now: Date): Workout[] {
  const k = monthKey(now);
  return alive(workouts).filter((w) => monthKey(w.startedAt) === k);
}

export function workoutsThisWeek(workouts: readonly Workout[], now: Date): Workout[] {
  const k = weekKey(now);
  return alive(workouts).filter((w) => weekKey(w.startedAt) === k);
}

/** Workouts gegroepeerd per lokale dag. */
export function byDay(workouts: readonly Workout[]): Map<string, Workout[]> {
  const m = new Map<string, Workout[]>();
  for (const w of alive(workouts)) {
    const k = dayKey(w.startedAt);
    const arr = m.get(k) ?? [];
    arr.push(w);
    m.set(k, arr);
  }
  return m;
}

export function sortByStartDesc(ws: readonly Workout[]): Workout[] {
  return [...ws].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
}

export interface PeriodSummary {
  workouts: number;
  durationSec: number;
  volume: number;
  sets: number;
  /** Gemiddeld aantal workouts per week in de periode. */
  perWeek: number;
  topExercises: { name: string; count: number }[];
}

export function summarize(workouts: readonly Workout[], from: Date, to: Date): PeriodSummary {
  const inRange = alive(workouts).filter((w) => {
    const t = new Date(w.startedAt).getTime();
    return t >= from.getTime() && t < to.getTime();
  });
  const counts = new Map<string, number>();
  for (const w of inRange) for (const we of w.exercises) counts.set(we.exerciseName, (counts.get(we.exerciseName) ?? 0) + 1);
  const weeks = Math.max(1, (to.getTime() - from.getTime()) / (7 * 864e5));
  return {
    workouts: inRange.length,
    durationSec: inRange.reduce((s, w) => s + w.durationSec, 0),
    volume: inRange.reduce((s, w) => s + workoutVolume(w), 0),
    sets: inRange.reduce((s, w) => s + completedSetCount(w), 0),
    perWeek: inRange.length / weeks,
    topExercises: [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 5),
  };
}
