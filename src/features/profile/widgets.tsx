import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Target, Trophy } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { BarsChart, TrendChart } from '@/components/charts';
import type { Exercise, Goal, Measurement, Profile, WidgetKind, Workout } from '@/lib/db/types';
import { weeklyBuckets, workoutsInMonth, workoutsThisWeek } from '@/domain/stats';
import { detectNewPrs, PR_LABELS } from '@/domain/prs';
import { formatDate, formatShortDate } from '@/domain/dates';
import { formatDuration, formatInt, formatNumber } from '@/domain/format';
import { goalProgress } from '@/domain/goals';
import { BODYWEIGHT_TYPE_ID } from '@/data/measurementTypes';
import { WorkoutCard } from '@/features/history/HistoryPage';
import { formatPr } from '@/features/workout/FinishSheet';

export const WIDGET_LABELS: Record<WidgetKind, string> = {
  workouts_per_week: 'Workouts per week',
  volume_per_week: 'Volume per week',
  time_this_week: 'Trainingstijd deze week',
  workouts_this_month: 'Workouts deze maand',
  last_workout: 'Laatste workout',
  recent_prs: "Recente PR's",
  bodyweight: 'Lichaamsgewicht',
  goals: 'Doelen',
};

export const DEFAULT_WIDGETS: WidgetKind[] = ['workouts_per_week', 'time_this_week', 'workouts_this_month', 'last_workout', 'volume_per_week', 'recent_prs', 'bodyweight', 'goals'];

export interface WidgetData {
  workouts: Workout[];
  measurements: Measurement[];
  goals: Goal[];
  exercises: Map<string, Exercise>;
  profile: Profile;
  now: Date;
  onGoalClick: () => void;
}

/** Kleine widgets (één getal) nemen een halve breedte op mobiel. */
export const SMALL_WIDGETS: WidgetKind[] = ['time_this_week', 'workouts_this_month'];

export function Widget({ kind, d }: { kind: WidgetKind; d: WidgetData }) {
  switch (kind) {
    case 'workouts_per_week': {
      const b = weeklyBuckets(d.workouts, 8, d.now);
      return (
        <Card>
          <CardHeader
            title="Workouts per week"
            subtitle={`Doel: ${d.profile.weeklyWorkoutGoal} per week`}
            action={
              <button type="button" onClick={d.onGoalClick} className="tap -m-2 flex items-center justify-center rounded-lg text-accent" aria-label="Weekdoel instellen">
                <Target size={20} />
              </button>
            }
          />
          <div className="p-2">
            <BarsChart goal={d.profile.weeklyWorkoutGoal} data={b.map((x) => ({ label: formatShortDate(x.weekStart), value: x.count }))} />
          </div>
        </Card>
      );
    }
    case 'volume_per_week': {
      const b = weeklyBuckets(d.workouts, 8, d.now);
      return (
        <Card>
          <CardHeader title="Volume per week" subtitle="kg × reps" />
          <div className="p-2">
            <BarsChart unit="kg" data={b.map((x) => ({ label: formatShortDate(x.weekStart), value: Math.round(x.volume) }))} />
          </div>
        </Card>
      );
    }
    case 'time_this_week': {
      const ws = workoutsThisWeek(d.workouts, d.now);
      return (
        <Card className="p-4">
          <p className="label">Trainingstijd</p>
          <p className="num mt-1 text-2xl font-semibold">{formatDuration(ws.reduce((s, w) => s + w.durationSec, 0))}</p>
          <p className="text-xs text-muted">deze week · {ws.length} workout{ws.length === 1 ? '' : 's'}</p>
        </Card>
      );
    }
    case 'workouts_this_month': {
      const n = workoutsInMonth(d.workouts, d.now).length;
      return (
        <Card className="kpi-hero p-4">
          <p className="label text-accent">Workouts</p>
          <p className="num mt-1 text-2xl font-semibold text-accent">{n}</p>
          <p className="text-xs text-muted">deze maand</p>
        </Card>
      );
    }
    case 'last_workout': {
      const w = d.workouts[0];
      return w ? (
        <div>
          <p className="label mb-2">Laatste workout</p>
          <WorkoutCard w={w} />
        </div>
      ) : (
        <Card className="p-4 text-sm text-muted">Nog geen workouts.</Card>
      );
    }
    case 'recent_prs':
      return <RecentPrs workouts={d.workouts} />;
    case 'bodyweight': {
      const bw = d.measurements.filter((m) => m.typeId === BODYWEIGHT_TYPE_ID);
      const last = bw.at(-1);
      return (
        <Card>
          <CardHeader
            title="Lichaamsgewicht"
            subtitle={last ? `${formatNumber(last.value)} kg · ${formatDate(last.measuredAt)}` : 'Nog geen meting'}
            action={
              <Link to={`/measure/${BODYWEIGHT_TYPE_ID}`} className="text-sm text-accent">
                Alles
              </Link>
            }
          />
          <div className="p-2">
            {bw.length > 1 ? (
              <TrendChart unit="kg" height={150} data={bw.slice(-20).map((m) => ({ label: formatShortDate(m.measuredAt), value: m.value }))} />
            ) : (
              <p className="p-4 text-sm text-muted">Voeg minstens twee metingen toe voor een grafiek.</p>
            )}
          </div>
        </Card>
      );
    }
    case 'goals': {
      const active = d.goals.filter((g) => !g.completedAt);
      return (
        <Card>
          <CardHeader
            title="Doelen"
            action={
              <Link to="/goals" className="text-sm text-accent">
                Beheren
              </Link>
            }
          />
          <div className="space-y-3 p-4">
            {active.length === 0 && <p className="text-sm text-muted">Geen actieve doelen.</p>}
            {active.slice(0, 4).map((g) => {
              const p = goalProgress(g, { workouts: d.workouts, measurements: d.measurements, bodyweightTypeId: BODYWEIGHT_TYPE_ID, exercises: d.exercises, now: d.now });
              return (
                <div key={g.id}>
                  <div className="flex justify-between text-sm">
                    <span className="truncate">{g.title || p.label}</span>
                    <span className="text-muted">{formatInt(p.ratio * 100)}%</span>
                  </div>
                  <div className="bar mt-1.5">
                    <span style={{ width: `${p.ratio * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      );
    }
  }
}

function RecentPrs({ workouts }: { workouts: Workout[] }) {
  const prs = useMemo(() => {
    const out: { date: string; text: string; kind: string; id: string }[] = [];
    for (const w of workouts.slice(0, 15)) {
      for (const p of detectNewPrs(w, workouts)) out.push({ id: w.id, date: w.startedAt, kind: PR_LABELS[p.kind], text: `${p.exerciseName}: ${formatPr(p)}` });
      if (out.length >= 6) break;
    }
    return out.slice(0, 6);
  }, [workouts]);
  return (
    <Card>
      <CardHeader title="Recente PR's" />
      <ul className="space-y-2 p-4 text-sm">
        {prs.length === 0 && <li className="text-muted">Nog geen records. Blijf sterker worden!</li>}
        {prs.map((p, i) => (
          <li key={i} className="flex gap-2">
            <Trophy size={16} className="mt-0.5 shrink-0 text-accent" />
            <Link to={`/history/${p.id}`} className="min-w-0">
              <span className="block">{p.text}</span>
              <span className="text-xs text-muted">
                {p.kind} · {formatDate(p.date)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
