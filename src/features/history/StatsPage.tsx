import { useMemo, useState } from 'react';
import { PageHeader, Tabs } from '@/components/ui/PageHeader';
import { Card, CardHeader, Stat } from '@/components/ui/Card';
import { EmptyState, Spinner } from '@/components/ui/States';
import { BarsChart, TrendChart } from '@/components/charts';
import { useExerciseMap, useWorkouts } from '@/lib/db/hooks';
import { MUSCLES, type Muscle, type Workout } from '@/lib/db/types';
import { MUSCLE_LABELS } from '@/domain/exerciseTypes';
import { addDays, addMonths, formatShortDate, startOfMonth, startOfWeek, weekKey } from '@/domain/dates';
import { summarize } from '@/domain/stats';
import { exerciseSessions } from '@/domain/exerciseHistory';
import { workoutVolume } from '@/domain/volume';
import { formatDuration, formatNumber, formatVolume } from '@/domain/format';

type Period = 'week' | 'month' | 'year';

function range(p: Period, now: Date): [Date, Date] {
  if (p === 'week') {
    const s = startOfWeek(now);
    return [s, addDays(s, 7)];
  }
  if (p === 'month') {
    const s = startOfMonth(now);
    return [s, addMonths(s, 1)];
  }
  return [new Date(now.getFullYear(), 0, 1), new Date(now.getFullYear() + 1, 0, 1)];
}

export default function StatsPage() {
  const workouts = useWorkouts();
  const exercises = useExerciseMap();
  const [period, setPeriod] = useState<Period>('month');
  const [muscle, setMuscle] = useState<Muscle | ''>('');
  const [exerciseId, setExerciseId] = useState('');
  const now = useMemo(() => new Date(), []);

  // Filter op spiergroep: alleen oefeningen van die spiergroep tellen mee.
  const filtered = useMemo<Workout[]>(() => {
    if (!workouts || !exercises) return [];
    if (!muscle) return workouts;
    return workouts
      .map((w) => ({ ...w, exercises: w.exercises.filter((we) => we.exerciseId && exercises.get(we.exerciseId)?.primaryMuscle === muscle) }))
      .filter((w) => w.exercises.length > 0);
  }, [workouts, exercises, muscle]);

  const [from, to] = range(period, now);
  const summary = useMemo(() => summarize(filtered, from, to), [filtered, from, to]);

  // Laatste 12 weken, volume en aantal
  const weekly = useMemo(() => {
    const start = addDays(startOfWeek(now), -7 * 11);
    const buckets = Array.from({ length: 12 }, (_, i) => ({ key: weekKey(addDays(start, i * 7)), label: formatShortDate(addDays(start, i * 7)), count: 0, volume: 0 }));
    const idx = new Map(buckets.map((b, i) => [b.key, i]));
    for (const w of filtered) {
      const i = idx.get(weekKey(w.startedAt));
      if (i === undefined) continue;
      buckets[i]!.count++;
      buckets[i]!.volume += workoutVolume(w);
    }
    return buckets;
  }, [filtered, now]);

  const usedExercises = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of workouts ?? []) for (const we of w.exercises) if (we.exerciseId && !m.has(we.exerciseId)) m.set(we.exerciseId, we.exerciseName);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [workouts]);

  const evolution = useMemo(() => (workouts && exerciseId ? exerciseSessions(workouts, exerciseId).reverse() : []), [workouts, exerciseId]);

  if (!workouts || !exercises) return <Spinner />;
  if (workouts.length === 0) return <EmptyState title="Nog geen statistieken" text="Na je eerste workout verschijnen hier je cijfers." />;

  return (
    <div>
      <PageHeader title="Statistieken" back="/history" />
      <div className="space-y-4 px-4 desk:px-0">
        <div className="grid gap-2 sm:grid-cols-[1fr_200px]">
          <Tabs
            value={period}
            onChange={setPeriod}
            tabs={[
              { value: 'week', label: 'Week' },
              { value: 'month', label: 'Maand' },
              { value: 'year', label: 'Jaar' },
            ]}
          />
          <select className="field" aria-label="Spiergroep" value={muscle} onChange={(e) => setMuscle(e.target.value as Muscle | '')}>
            <option value="">Alle spiergroepen</option>
            {MUSCLES.map((m) => (
              <option key={m} value={m}>
                {MUSCLE_LABELS[m]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Stat hero label="Workouts" value={summary.workouts} hint={`${formatNumber(Math.round(summary.perWeek * 10) / 10)} per week`} />
          <Stat label="Tijd" value={formatDuration(summary.durationSec)} />
          <Stat label="Volume" value={formatVolume(summary.volume)} />
          <Stat label="Sets" value={summary.sets} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Workouts per week" subtitle="Laatste 12 weken" />
            <div className="p-2">
              <BarsChart data={weekly.map((b) => ({ label: b.label, value: b.count }))} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Volume per week" subtitle="kg × reps, laatste 12 weken" />
            <div className="p-2">
              <BarsChart unit="kg" data={weekly.map((b) => ({ label: b.label, value: Math.round(b.volume) }))} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Meest gedane oefeningen" subtitle="In de gekozen periode" />
            <ul className="p-4 pt-2 text-sm">
              {summary.topExercises.length === 0 && <li className="text-muted">Geen workouts in deze periode.</li>}
              {summary.topExercises.map((e) => (
                <li key={e.name} className="flex justify-between py-1">
                  <span>{e.name}</span>
                  <span className="text-muted">{e.count}×</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Evolutie per oefening" />
            <div className="p-3">
              <select className="field" aria-label="Oefening" value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}>
                <option value="">Kies een oefening…</option>
                {usedExercises.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
              {exerciseId && evolution.length > 0 && (
                <TrendChart unit="kg" data={evolution.map((s) => ({ label: formatShortDate(s.startedAt), value: s.heaviest }))} />
              )}
              {exerciseId && evolution.length === 0 && <p className="p-2 text-sm text-muted">Geen gegevens.</p>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
