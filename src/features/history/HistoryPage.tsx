import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BarChart3, CalendarDays, ChevronLeft, ChevronRight, Clock, Dumbbell, List } from 'lucide-react';
import { PageHeader, Tabs } from '@/components/ui/PageHeader';
import { Button, IconButton } from '@/components/ui/Button';
import { EmptyState, Spinner } from '@/components/ui/States';
import { useWorkouts } from '@/lib/db/hooks';
import type { Workout } from '@/lib/db/types';
import { addMonths, dayKey, formatDate, formatMonth, monthGrid, monthKey, startOfMonth } from '@/domain/dates';
import { byDay } from '@/domain/stats';
import { bestSet, completedSetCount, workoutVolume } from '@/domain/volume';
import { formatDuration, formatSet, formatVolume } from '@/domain/format';
import { useActiveWorkout } from '@/features/workout/WorkoutProvider';
import { newActiveWorkout } from '@/features/workout/logic';

export function WorkoutCard({ w }: { w: Workout }) {
  return (
    <Link to={`/history/${w.id}`} className="card block p-4 transition hover:border-accent/40">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold">{w.name}</p>
          <p className="text-xs text-muted">{formatDate(w.startedAt)}</p>
        </div>
        {w.source === 'strong_import' && <span className="rounded-md bg-surface-2 px-2 py-0.5 text-[10px] text-faint">Strong</span>}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1">
          <Clock size={13} /> {formatDuration(w.durationSec)}
        </span>
        <span className="flex items-center gap-1">
          <Dumbbell size={13} /> {w.exercises.length} oef. · {completedSetCount(w)} sets
        </span>
        {workoutVolume(w) > 0 && <span>{formatVolume(workoutVolume(w))}</span>}
      </div>
      <ul className="mt-3 space-y-0.5 text-sm">
        {w.exercises.slice(0, 6).map((we) => {
          const b = bestSet(we);
          return (
            <li key={we.id} className="flex justify-between gap-3">
              <span className="truncate text-muted">
                {we.sets.filter((s) => s.completed).length} × {we.exerciseName}
              </span>
              <span className="shrink-0 tabular-nums">{b ? formatSet(we.exerciseType, b) : ''}</span>
            </li>
          );
        })}
        {w.exercises.length > 6 && <li className="text-xs text-faint">+{w.exercises.length - 6} meer</li>}
      </ul>
    </Link>
  );
}

function Calendar({ workouts }: { workouts: Workout[] }) {
  const [params, setParams] = useSearchParams();
  const today = new Date();
  const thisMonth = startOfMonth(today);
  const m = params.get('m');
  const month = m ? new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 1) : thisMonth;
  const [selected, setSelected] = useState<string | null>(null);
  const days = useMemo(() => byDay(workouts), [workouts]);
  const grid = monthGrid(month.getFullYear(), month.getMonth());
  const isCurrent = monthKey(month) === monthKey(thisMonth);
  const go = (n: number) => {
    setSelected(null);
    setParams({ view: 'calendar', m: monthKey(addMonths(month, n)) }, { replace: true });
  };
  const inMonth = workouts.filter((w) => monthKey(w.startedAt) === monthKey(month));
  const selectedList = selected ? (days.get(selected) ?? []) : [];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
      <div className="card p-3">
        <div className="mb-2 flex items-center justify-between">
          <IconButton label="Vorige maand" onClick={() => go(-1)}>
            <ChevronLeft />
          </IconButton>
          <p className="font-semibold capitalize">{formatMonth(month)}</p>
          <IconButton label="Volgende maand" onClick={() => go(1)} disabled={isCurrent}>
            <ChevronRight />
          </IconButton>
        </div>
        <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-faint">
          {['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'].map((d) => (
            <span key={d} className="py-1">
              {d}
            </span>
          ))}
        </div>
        {grid.map((week, i) => (
          <div key={i} className="grid grid-cols-7">
            {week.map((d, j) => {
              if (!d) return <span key={j} />;
              const k = dayKey(d);
              const has = days.has(k);
              const isToday = k === dayKey(today);
              return (
                <button
                  key={j}
                  type="button"
                  disabled={!has}
                  onClick={() => setSelected(k === selected ? null : k)}
                  aria-label={`${formatDate(d)}${has ? `, ${days.get(k)!.length} workout(s)` : ''}`}
                  className={`relative mx-auto my-0.5 flex h-10 w-10 items-center justify-center rounded-full text-sm tabular-nums ${
                    has ? (selected === k ? 'bg-accent font-bold text-accent-ink' : 'bg-primary font-semibold text-accent') : 'text-muted'
                  } ${isToday && !has ? 'ring-1 ring-border' : ''}`}
                >
                  {d.getDate()}
                  {has && days.get(k)!.length > 1 && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-accent" />}
                </button>
              );
            })}
          </div>
        ))}
        <p className="mt-2 text-center text-xs text-muted">
          {inMonth.length} workout{inMonth.length === 1 ? '' : 's'} deze maand
        </p>
      </div>
      <div className="grid content-start gap-3">
        {(selected ? selectedList : inMonth).map((w) => (
          <WorkoutCard key={w.id} w={w} />
        ))}
        {!selected && inMonth.length === 0 && <p className="p-4 text-sm text-muted">Geen workouts in deze maand.</p>}
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const workouts = useWorkouts();
  const [params, setParams] = useSearchParams();
  const view = (params.get('view') as 'list' | 'calendar') ?? 'list';
  const { start } = useActiveWorkout();
  const [limit, setLimit] = useState(30);

  const grouped = useMemo(() => {
    const m = new Map<string, Workout[]>();
    for (const w of (workouts ?? []).slice(0, limit)) {
      const k = monthKey(w.startedAt);
      m.set(k, [...(m.get(k) ?? []), w]);
    }
    return [...m.entries()];
  }, [workouts, limit]);

  return (
    <div>
      <PageHeader
        title="Geschiedenis"
        actions={
          <Link to="/stats" className="tap flex items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-text" aria-label="Statistieken">
            <BarChart3 size={22} />
          </Link>
        }
      />
      <div className="space-y-4 px-4 md:px-0">
        <Tabs
          value={view}
          onChange={(v) => setParams({ view: v }, { replace: true })}
          tabs={[
            { value: 'list', label: 'Lijst' },
            { value: 'calendar', label: 'Kalender' },
          ]}
        />
        {!workouts ? (
          <Spinner />
        ) : workouts.length === 0 ? (
          <EmptyState
            icon={view === 'list' ? <List /> : <CalendarDays />}
            title="Nog geen workouts"
            text="Je afgeronde workouts verschijnen hier."
            action={
              <Button variant="primary" onClick={() => start(newActiveWorkout('Workout', new Date()))}>
                Start je eerste workout
              </Button>
            }
          />
        ) : view === 'calendar' ? (
          <Calendar workouts={workouts} />
        ) : (
          <>
            {grouped.map(([month, list]) => (
              <section key={month}>
                <h2 className="mb-2 mt-2 text-sm font-semibold capitalize text-muted">
                  {formatMonth(new Date(Number(month.slice(0, 4)), Number(month.slice(5)) - 1, 1))} · {list.length}
                </h2>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {list.map((w) => (
                    <WorkoutCard key={w.id} w={w} />
                  ))}
                </div>
              </section>
            ))}
            {workouts.length > limit && (
              <Button block onClick={() => setLimit((l) => l + 30)}>
                Meer laden ({workouts.length - limit})
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
