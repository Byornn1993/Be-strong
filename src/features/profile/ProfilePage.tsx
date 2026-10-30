import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Dumbbell, Flame, LayoutGrid, Plus, Settings, Target, X } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button, IconButton } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { EmptyState, Spinner } from '@/components/ui/States';
import { SortableList } from '@/components/SortableList';
import { useExerciseMap, useGoals, useMeasurements, useProfile, useWidgets, useWorkouts } from '@/lib/db/hooks';
import { saveProfile, saveWidgets } from '@/lib/db/repo';
import { newId } from '@/lib/ids';
import { WIDGET_KINDS, type DashboardWidget, type WidgetKind } from '@/lib/db/types';
import { streakWeeks } from '@/domain/stats';
import { goalProgress } from '@/domain/goals';
import { BODYWEIGHT_TYPE_ID } from '@/data/measurementTypes';
import { useAuth } from '@/features/auth/AuthProvider';
import { useActiveWorkout } from '@/features/workout/WorkoutProvider';
import { newActiveWorkout, reorderExercises } from '@/features/workout/logic';
import { DEFAULT_WIDGETS, SMALL_WIDGETS, WIDGET_LABELS, Widget } from './widgets';

export default function ProfilePage() {
  const { session } = useAuth();
  const profile = useProfile();
  const workouts = useWorkouts();
  const measurements = useMeasurements();
  const goals = useGoals();
  const exercises = useExerciseMap();
  const stored = useWidgets();
  const { start, active } = useActiveWorkout();
  const [editing, setEditing] = useState<WidgetKind[] | null>(null);
  const [goalSheet, setGoalSheet] = useState(false);
  const now = useMemo(() => new Date(), []);

  const kinds = useMemo<WidgetKind[]>(() => (stored && stored.length ? stored.map((w) => w.kind) : DEFAULT_WIDGETS), [stored]);

  if (!profile || !workouts || !measurements || !goals || !exercises || !stored) return <Spinner />;

  const name = profile.displayName || session?.user.email?.split('@')[0] || 'Atleet';
  const streak = streakWeeks(workouts, now);
  const activeGoal = goals.find((g) => !g.completedAt);
  const goalText = activeGoal
    ? activeGoal.title || goalProgress(activeGoal, { workouts, measurements, bodyweightTypeId: BODYWEIGHT_TYPE_ID, exercises, now }).label
    : `${profile.weeklyWorkoutGoal}× per week`;

  const saveLayout = async (list: WidgetKind[]) => {
    const byKind = new Map(stored.map((w) => [w.kind, w]));
    const rows: DashboardWidget[] = list.map((k, i) => ({
      id: byKind.get(k)?.id ?? newId(),
      kind: k,
      position: i,
      config: byKind.get(k)?.config ?? {},
      serverUpdatedAt: byKind.get(k)?.serverUpdatedAt ?? null,
      deletedAt: null,
    }));
    const removed = stored.filter((w) => !list.includes(w.kind)).map((w) => ({ ...w, deletedAt: new Date().toISOString() }));
    await saveWidgets([...rows, ...removed]);
    setEditing(null);
  };

  return (
    <div>
      <PageHeader
        title="Profiel"
        actions={
          <Link to="/settings" aria-label="Instellingen" className="tap flex items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-text">
            <Settings size={22} />
          </Link>
        }
      />
      <div className="space-y-4 px-4 desk:px-0">
        <div className="card flex items-center gap-4 p-4">
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-accent">{name.charAt(0).toUpperCase()}</div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold">{name}</p>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
              <span className="flex items-center gap-1">
                <Dumbbell size={14} /> {workouts.length} workouts
              </span>
              <span className="flex items-center gap-1">
                <Flame size={14} className={streak ? 'text-accent' : ''} /> {streak} {streak === 1 ? 'week' : 'weken'} streak
              </span>
              <span className="flex items-center gap-1">
                <Target size={14} /> {goalText}
              </span>
            </div>
          </div>
        </div>

        {workouts.length === 0 && (
          <div className="card">
            <EmptyState
              icon={<Dumbbell />}
              title="Welkom bij Be Strong"
              text="Je dashboard vult zich met echte cijfers zodra je workouts logt of je Strong-geschiedenis importeert."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  {!active && (
                    <Button variant="primary" onClick={() => start(newActiveWorkout('Workout', new Date()))}>
                      Start je eerste workout
                    </Button>
                  )}
                  <Link to="/settings/import">
                    <Button>Strong-data importeren</Button>
                  </Link>
                </div>
              }
            />
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="label">Overzicht</p>
          <Button size="sm" variant="ghost" icon={<LayoutGrid size={16} />} onClick={() => setEditing(kinds)}>
            Widgets
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kinds.map((k) => (
            <div key={k} className={SMALL_WIDGETS.includes(k) ? 'col-span-1' : 'col-span-2'}>
              <Widget kind={k} d={{ workouts, measurements, goals, exercises, profile, now, onGoalClick: () => setGoalSheet(true) }} />
            </div>
          ))}
        </div>
      </div>

      <Sheet
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Widgets"
        footer={
          <Button variant="primary" size="lg" block onClick={() => editing && saveLayout(editing)}>
            Bewaren
          </Button>
        }
      >
        {editing && (
          <div className="space-y-3 p-3">
            <SortableList
              items={editing.map((k) => ({ id: k }))}
              onReorder={(from, to) => setEditing(reorderExercises(editing.map((k) => ({ id: k })), from, to).map((x) => x.id as WidgetKind))}
              render={(item, handle) => (
                <div className="mb-1 flex items-center gap-1 rounded-xl bg-surface-2 pr-1">
                  {handle}
                  <span className="flex-1 text-sm">{WIDGET_LABELS[item.id as WidgetKind]}</span>
                  <IconButton label="Verwijderen" onClick={() => setEditing(editing.filter((k) => k !== item.id))}>
                    <X size={16} />
                  </IconButton>
                </div>
              )}
            />
            {WIDGET_KINDS.filter((k) => !editing.includes(k)).length > 0 && <p className="label pt-2">Toevoegen</p>}
            {WIDGET_KINDS.filter((k) => !editing.includes(k)).map((k) => (
              <Button key={k} block size="sm" icon={<Plus size={14} />} onClick={() => setEditing([...editing, k])}>
                {WIDGET_LABELS[k]}
              </Button>
            ))}
          </div>
        )}
      </Sheet>

      <Sheet open={goalSheet} onClose={() => setGoalSheet(false)} title="Weekdoel">
        <div className="grid grid-cols-4 gap-2 p-4">
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <Button
              key={n}
              size="lg"
              variant={profile.weeklyWorkoutGoal === n ? 'primary' : 'secondary'}
              onClick={async () => {
                await saveProfile({ ...profile, weeklyWorkoutGoal: n });
                setGoalSheet(false);
              }}
            >
              {n}×
            </Button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
