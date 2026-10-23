import type { ActiveWorkout, RestTimerState } from '@/lib/db/types';

// Rusttimer en workoutklok werken op basis van timestamps, niet met een tellende interval.
// Daardoor blijven ze correct na het wisselen van app, vergrendelen of een refresh.

export function startRest(totalSec: number, now: number, workoutExerciseId: string | null = null): RestTimerState {
  return { endsAt: now + totalSec * 1000, totalSec, workoutExerciseId };
}

export function restRemainingSec(rest: RestTimerState | null, now: number): number {
  if (!rest) return 0;
  return Math.max(0, Math.ceil((rest.endsAt - now) / 1000));
}

export function isRestDone(rest: RestTimerState | null, now: number): boolean {
  return !!rest && now >= rest.endsAt;
}

/** −15s / +15s. Nooit onder "nu"; totaal groeit mee zodat de voortgangsbalk klopt. */
export function adjustRest(rest: RestTimerState, deltaSec: number, now: number): RestTimerState | null {
  const endsAt = Math.max(now, rest.endsAt + deltaSec * 1000);
  if (endsAt <= now) return null;
  const totalSec = Math.max(1, rest.totalSec + deltaSec);
  return { ...rest, endsAt, totalSec };
}

/** 0..1, hoeveel van de rust al voorbij is. */
export function restProgress(rest: RestTimerState | null, now: number): number {
  if (!rest || rest.totalSec <= 0) return 1;
  const remaining = (rest.endsAt - now) / 1000;
  return Math.min(1, Math.max(0, 1 - remaining / rest.totalSec));
}

/** Verstreken actieve tijd van de workout in seconden (pauzes niet meegerekend). */
export function workoutElapsedSec(w: Pick<ActiveWorkout, 'startedAt' | 'pausedAt' | 'pausedMs'>, now: number): number {
  const start = new Date(w.startedAt).getTime();
  const end = w.pausedAt ? new Date(w.pausedAt).getTime() : now;
  return Math.max(0, Math.floor((end - start - w.pausedMs) / 1000));
}

export function pause<T extends Pick<ActiveWorkout, 'pausedAt'>>(w: T, nowIso: string): T {
  return w.pausedAt ? w : { ...w, pausedAt: nowIso };
}

export function resume<T extends Pick<ActiveWorkout, 'pausedAt' | 'pausedMs' | 'rest'>>(w: T, now: number): T {
  if (!w.pausedAt) return w;
  const pausedFor = now - new Date(w.pausedAt).getTime();
  // Een lopende rusttimer schuift mee met de pauze.
  const rest = w.rest ? { ...w.rest, endsAt: w.rest.endsAt + pausedFor } : null;
  return { ...w, pausedAt: null, pausedMs: w.pausedMs + Math.max(0, pausedFor), rest };
}
