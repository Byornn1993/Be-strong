import { describe, expect, it } from 'vitest';
import { dayKey, monthGrid, toLocalIso, weekKey } from '@/domain/dates';
import { findPreviousSets, previousForIndex } from '@/domain/previous';
import { computeRecords, detectNewPrs, epley } from '@/domain/prs';
import { streakWeeks, summarize, weeklyBuckets } from '@/domain/stats';
import { adjustRest, isRestDone, pause, restRemainingSec, resume, startRest, workoutElapsedSec } from '@/domain/timer';
import { bestSet, workoutVolume } from '@/domain/volume';
import { formatClock, formatDuration, formatSet } from '@/domain/format';
import { set, workout } from './helpers';

describe('datums (Europe/Brussels, week start op maandag)', () => {
  it('een workout om 23:30 blijft op dezelfde lokale dag', () => {
    expect(dayKey('2026-10-20T23:30:00+02:00')).toBe('2026-10-20');
    // Zelfde moment in UTC-notatie: lokaal nog steeds 20/10
    expect(dayKey('2026-10-20T21:30:00Z')).toBe('2026-10-20');
  });
  it('toLocalIso bewaart de offset (zomer- en wintertijd)', () => {
    expect(toLocalIso(new Date(2026, 6, 1, 23, 30))).toBe('2026-07-01T23:30:00.000+02:00');
    expect(toLocalIso(new Date(2026, 11, 1, 23, 30))).toBe('2026-12-01T23:30:00.000+01:00');
  });
  it('weekKey is de maandag; zondag hoort bij de week ervoor', () => {
    expect(weekKey('2026-10-25T20:00:00+01:00')).toBe('2026-10-19'); // zondag
    expect(weekKey('2026-10-26T08:00:00+01:00')).toBe('2026-10-26'); // maandag
  });
  it('maandraster begint op maandag', () => {
    const g = monthGrid(2026, 7); // augustus 2026 start op zaterdag
    expect(g[0]!.slice(0, 5).every((c) => c === null)).toBe(true);
    expect(g[0]![5]!.getDate()).toBe(1);
  });
});

describe('rusttimer (timestamp-gebaseerd)', () => {
  const t0 = 1_000_000;
  it('berekent resterende tijd uit de eindtijd, ook na een lange onderbreking', () => {
    const r = startRest(120, t0);
    expect(restRemainingSec(r, t0)).toBe(120);
    expect(restRemainingSec(r, t0 + 30_500)).toBe(90);
    expect(isRestDone(r, t0 + 119_999)).toBe(false);
    // App 10 minuten op de achtergrond: geen "achterstand", gewoon klaar.
    expect(restRemainingSec(r, t0 + 600_000)).toBe(0);
    expect(isRestDone(r, t0 + 600_000)).toBe(true);
  });
  it('−15s / +15s', () => {
    const r = startRest(120, t0);
    expect(restRemainingSec(adjustRest(r, 15, t0)!, t0)).toBe(135);
    expect(restRemainingSec(adjustRest(r, -15, t0)!, t0)).toBe(105);
    expect(adjustRest(startRest(10, t0), -15, t0)).toBeNull();
  });
  it('pauzeren schuift de workoutklok en de rusttimer op', () => {
    const start = new Date(2026, 9, 20, 10, 0, 0);
    let w = { startedAt: toLocalIso(start), pausedAt: null as string | null, pausedMs: 0, rest: startRest(120, start.getTime() + 60_000) };
    expect(workoutElapsedSec(w, start.getTime() + 90_000)).toBe(90);
    w = pause(w, new Date(start.getTime() + 90_000).toISOString());
    expect(workoutElapsedSec(w, start.getTime() + 500_000)).toBe(90); // klok staat stil
    w = resume(w, start.getTime() + 390_000); // 5 min pauze
    expect(workoutElapsedSec(w, start.getTime() + 400_000)).toBe(100);
    expect(restRemainingSec(w.rest, start.getTime() + 400_000)).toBe(80);
  });
});

describe('Previous', () => {
  const ws = [
    workout('2026-10-01T10:00:00+02:00', [{ name: 'Bench Press (Dumbbell)', sets: [set(20, 10), set(22, 8)] }]),
    workout('2026-10-08T10:00:00+02:00', [{ name: 'Bench Press (Dumbbell)', sets: [set(24, 8), set(24, 7, { completed: false }), set(26, 6)] }]),
    workout('2026-10-15T10:00:00+02:00', [{ name: 'Squat (Barbell)', sets: [set(80, 5)] }]),
  ];
  const ref = { exerciseId: ws[0]!.exercises[0]!.exerciseId, exerciseName: 'Bench Press (Dumbbell)' };

  it('neemt de laatste keer dat de oefening gedaan werd, alleen afgewerkte sets', () => {
    const prev = findPreviousSets(ws, ref, '2026-10-20T10:00:00+02:00');
    expect(prev.map((s) => [s.weightKg, s.reps])).toEqual([[24, 8], [26, 6]]);
    expect(previousForIndex(prev, 0)).toMatchObject({ weightKg: 24, reps: 8 });
    expect(previousForIndex(prev, 2)).toBeNull();
  });
  it('kijkt niet naar workouts op of na de huidige start', () => {
    const prev = findPreviousSets(ws, ref, '2026-10-08T10:00:00+02:00');
    expect(prev.map((s) => s.weightKg)).toEqual([20, 22]);
  });
  it('verwijderde workouts tellen niet mee; matcht op naam als het id ontbreekt', () => {
    const del = workout('2026-10-18T10:00:00+02:00', [{ name: 'Bench Press (Dumbbell)', sets: [set(99, 1)] }], { deletedAt: '2026-10-19T00:00:00Z' });
    const prev = findPreviousSets([...ws, del], { exerciseId: null, exerciseName: 'bench press (dumbbell) ' }, '2026-10-20T10:00:00+02:00');
    expect(prev[0]!.weightKg).toBe(24);
  });
});

describe('PR-berekening', () => {
  it('Epley, enkel 1–12 reps', () => {
    expect(epley(100, 1)).toBe(100);
    expect(epley(100, 10)).toBeCloseTo(133.33, 2);
    expect(epley(100, 13)).toBeNull();
  });
  it('warm-ups tellen nooit mee', () => {
    const ws = [workout('2026-10-01T10:00:00+02:00', [{ name: 'Squat (Barbell)', sets: [set(140, 1, { type: 'warmup' }), set(100, 5)] }])];
    const r = computeRecords(ws, { exerciseId: ws[0]!.exercises[0]!.exerciseId, exerciseName: 'Squat (Barbell)', type: 'weight_reps' });
    expect(r.heaviestWeight).toBe(100);
    expect(r.bestSetVolume).toBe(500);
    expect(r.repsAtWeight.get(100)).toBe(5);
  });
  it('alleen binnen hetzelfde oefeningtype', () => {
    const ws = [workout('2026-10-01T10:00:00+02:00', [{ name: 'Chin Up', type: 'weight_reps', sets: [set(80, 10)] }])];
    const r = computeRecords(ws, { exerciseId: ws[0]!.exercises[0]!.exerciseId, exerciseName: 'Chin Up', type: 'weighted_bodyweight' });
    expect(r.heaviestWeight).toBeNull();
  });
  it('detecteert nieuwe PR\'s t.o.v. eerdere workouts (eerste keer is geen PR)', () => {
    const old = workout('2026-10-01T10:00:00+02:00', [{ name: 'Squat (Barbell)', sets: [set(100, 5), set(100, 5)] }]);
    const now = workout('2026-10-08T10:00:00+02:00', [
      { name: 'Squat (Barbell)', sets: [set(105, 3), set(100, 6), set(100, 5)] },
      { name: 'Hack Squat', sets: [set(120, 10)] },
    ]);
    const prs = detectNewPrs(now, [old]);
    const kinds = prs.map((p) => p.kind).sort();
    expect(kinds).toEqual(['bestSessionVolume', 'bestSetVolume', 'estimated1RM', 'heaviestWeight', 'repsAtWeight']);
    expect(prs.find((p) => p.kind === 'repsAtWeight')).toMatchObject({ value: 6, previous: 5, atWeight: 100 });
    expect(prs.every((p) => p.exerciseName === 'Squat (Barbell)')).toBe(true);
  });
});

describe('volume & beste set', () => {
  it('volume telt alleen afgewerkte sets van gewichtstypes', () => {
    const w = workout('2026-10-01T10:00:00+02:00', [
      { name: 'Squat (Barbell)', sets: [set(100, 5), set(100, 5, { completed: false })] },
      { name: 'Crunch', sets: [set(80, 10)] },
      { name: 'Chin Up', sets: [set(10, 5)] },
    ]);
    expect(workoutVolume(w)).toBe(500 + 50);
  });
  it('beste set = zwaarste, dan meeste reps', () => {
    const w = workout('2026-10-01T10:00:00+02:00', [{ name: 'Squat (Barbell)', sets: [set(100, 8), set(110, 3), set(110, 5)] }]);
    expect(bestSet(w.exercises[0]!)).toMatchObject({ weightKg: 110, reps: 5 });
  });
});

describe('statistieken', () => {
  const now = new Date(2026, 9, 22, 12); // donderdag 22/10/2026
  it('workouts per week (laatste N weken)', () => {
    const ws = [
      workout('2026-10-19T08:00:00+02:00', []),
      workout('2026-10-21T08:00:00+02:00', []),
      workout('2026-10-14T08:00:00+02:00', []),
      workout('2026-10-14T18:00:00+02:00', [], { deletedAt: '2026-10-15T00:00:00Z' }),
    ];
    const b = weeklyBuckets(ws, 3, now);
    expect(b.map((x) => [x.weekStart, x.count])).toEqual([
      ['2026-10-05', 0],
      ['2026-10-12', 1],
      ['2026-10-19', 2],
    ]);
  });
  it('streak in weken: lopende week zonder workout breekt de streak niet', () => {
    const ws = [workout('2026-10-14T08:00:00+02:00', []), workout('2026-10-07T08:00:00+02:00', []), workout('2026-09-23T08:00:00+02:00', [])];
    expect(streakWeeks(ws, now)).toBe(2);
    expect(streakWeeks([...ws, workout('2026-10-20T08:00:00+02:00', [])], now)).toBe(3);
    expect(streakWeeks(ws, now, 2)).toBe(0);
  });
  it('periodeoverzicht', () => {
    const ws = [
      workout('2026-10-19T08:00:00+02:00', [{ name: 'Squat (Barbell)', sets: [set(100, 5)] }]),
      workout('2026-10-21T08:00:00+02:00', [{ name: 'Squat (Barbell)', sets: [set(100, 5)] }, { name: 'Hack Squat', sets: [set(50, 10)] }]),
    ];
    const s = summarize(ws, new Date(2026, 9, 19), new Date(2026, 9, 26));
    expect(s).toMatchObject({ workouts: 2, sets: 3, volume: 1500, durationSec: 7200 });
    expect(s.topExercises[0]).toEqual({ name: 'Squat (Barbell)', count: 2 });
  });
});

describe('weergave', () => {
  it('klok en duur', () => {
    expect(formatClock(65)).toBe('1:05');
    expect(formatClock(3723)).toBe('1:02:03');
    expect(formatDuration(3900)).toBe('1u 05m');
    expect(formatDuration(47)).toBe('47s');
  });
  it('set per type', () => {
    expect(formatSet('weight_reps', { weightKg: 24, reps: 8, durationSec: null, distanceM: null })).toBe('24 kg × 8');
    expect(formatSet('weighted_bodyweight', { weightKg: 10, reps: 6, durationSec: null, distanceM: null })).toBe('+10 kg × 6');
    expect(formatSet('assisted_bodyweight', { weightKg: 20, reps: 6, durationSec: null, distanceM: null })).toBe('−20 kg × 6');
    expect(formatSet('distance_duration', { weightKg: null, reps: null, durationSec: 960, distanceM: 1300 })).toBe('1,3 km · 16:00');
  });
});
