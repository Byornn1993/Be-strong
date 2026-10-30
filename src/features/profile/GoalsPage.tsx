import { useMemo, useState, type FormEvent } from 'react';
import { CheckCircle2, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Sheet } from '@/components/ui/Sheet';
import { EmptyState, Spinner } from '@/components/ui/States';
import { NumberInput } from '@/components/ui/NumberInput';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useExerciseMap, useExercises, useGoals, useMeasurements, useWorkouts } from '@/lib/db/hooks';
import { deleteGoal, saveGoal } from '@/lib/db/repo';
import { newId } from '@/lib/ids';
import { GOAL_KINDS, type Goal, type GoalKind } from '@/lib/db/types';
import { GOAL_LABELS, goalProgress } from '@/domain/goals';
import { formatDate } from '@/domain/dates';
import { formatInt } from '@/domain/format';
import { BODYWEIGHT_TYPE_ID } from '@/data/measurementTypes';

export default function GoalsPage() {
  const goals = useGoals();
  const workouts = useWorkouts();
  const measurements = useMeasurements();
  const exercises = useExerciseMap();
  const [editing, setEditing] = useState<Goal | 'new' | null>(null);
  const { confirm, dialog } = useConfirm();
  const now = useMemo(() => new Date(), []);

  if (!goals || !workouts || !measurements || !exercises) return <Spinner />;
  const ctx = { workouts, measurements, bodyweightTypeId: BODYWEIGHT_TYPE_ID, exercises, now };
  const sorted = [...goals].sort((a, b) => Number(!!a.completedAt) - Number(!!b.completedAt));

  return (
    <div>
      <PageHeader
        title="Doelen"
        back="/profile"
        actions={
          <Button size="sm" variant="primary" icon={<Plus size={16} />} onClick={() => setEditing('new')}>
            Doel
          </Button>
        }
      />
      <div className="grid gap-3 px-4 md:grid-cols-2 desk:px-0">
        {sorted.length === 0 && (
          <div className="md:col-span-2">
            <EmptyState title="Nog geen doelen" text="Stel een doel in voor je gewicht, frequentie, streak of een oefening." action={<Button variant="primary" onClick={() => setEditing('new')}>Doel toevoegen</Button>} />
          </div>
        )}
        {sorted.map((g) => {
          const p = goalProgress(g, ctx);
          return (
            <Card key={g.id} className={`p-4 ${g.completedAt ? 'opacity-60' : ''}`}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted">{GOAL_LABELS[g.kind]}</p>
                  <p className="font-semibold">{g.title || p.label}</p>
                  {g.title && <p className="text-xs text-muted">{p.label}</p>}
                  {g.deadline && <p className="text-xs text-faint">Tegen {formatDate(g.deadline)}</p>}
                </div>
                <IconButton label="Bewerken" onClick={() => setEditing(g)}>
                  <Pencil size={18} />
                </IconButton>
                <IconButton
                  label="Verwijderen"
                  onClick={async () => (await confirm({ title: 'Doel verwijderen?', confirmLabel: 'Verwijderen', danger: true })) && deleteGoal(g.id)}
                >
                  <Trash2 size={18} />
                </IconButton>
              </div>
              <div className="bar-lg mt-3">
                <span style={{ width: `${p.ratio * 100}%` }} />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted">
                <span>{formatInt(p.ratio * 100)}%</span>
                {g.completedAt ? (
                  <Button size="sm" variant="ghost" icon={<RotateCcw size={14} />} onClick={() => saveGoal({ ...g, completedAt: null })}>
                    Heropenen
                  </Button>
                ) : (
                  <Button size="sm" variant={p.done ? 'primary' : 'ghost'} icon={<CheckCircle2 size={14} />} onClick={() => saveGoal({ ...g, completedAt: new Date().toISOString() })}>
                    Afronden
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
      <GoalForm goal={editing === 'new' ? null : editing} open={!!editing} onClose={() => setEditing(null)} />
      {dialog}
    </div>
  );
}

function GoalForm({ goal, open, onClose }: { goal: Goal | null; open: boolean; onClose: () => void }) {
  const exercises = useExercises();
  return (
    <Sheet open={open} onClose={onClose} title={goal ? 'Doel bewerken' : 'Nieuw doel'}>
      {open && exercises && <GoalFormBody key={goal?.id ?? 'new'} goal={goal} onClose={onClose} exercises={exercises} />}
    </Sheet>
  );
}

function GoalFormBody({ goal, onClose, exercises }: { goal: Goal | null; onClose: () => void; exercises: NonNullable<ReturnType<typeof useExercises>> }) {
  const [kind, setKind] = useState<GoalKind>(goal?.kind ?? 'workouts_per_week');
  const [title, setTitle] = useState(goal?.title ?? '');
  const [target, setTarget] = useState<number | null>(goal?.targetValue ?? null);
  const [start, setStart] = useState<number | null>(goal?.startValue ?? null);
  const [exerciseId, setExerciseId] = useState(goal?.exerciseId ?? '');
  const [deadline, setDeadline] = useState(goal?.deadline ?? '');
  const [error, setError] = useState<string | null>(null);
  const needsExercise = kind === 'exercise_weight' || kind === 'exercise_reps';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (target === null || target <= 0) return setError('Vul een doelwaarde in.');
    if (needsExercise && !exerciseId) return setError('Kies een oefening.');
    await saveGoal({
      id: goal?.id ?? newId(),
      kind,
      title: title.trim() || null,
      exerciseId: needsExercise ? exerciseId : null,
      startValue: kind === 'bodyweight' ? start : null,
      targetValue: target,
      deadline: deadline || null,
      completedAt: goal?.completedAt ?? null,
      note: goal?.note ?? null,
      serverUpdatedAt: goal?.serverUpdatedAt ?? null,
      deletedAt: null,
    });
    onClose();
  };

  return (
    <form onSubmit={submit} className="space-y-4 p-4">
      <label className="block">
        <span className="label">Soort doel</span>
        <select className="field mt-1" value={kind} onChange={(e) => setKind(e.target.value as GoalKind)}>
          {GOAL_KINDS.map((k) => (
            <option key={k} value={k}>
              {GOAL_LABELS[k]}
            </option>
          ))}
        </select>
      </label>
      {needsExercise && (
        <label className="block">
          <span className="label">Oefening</span>
          <select className="field mt-1" value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}>
            <option value="">Kies…</option>
            {exercises.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label">Doel ({kind === 'bodyweight' || kind === 'exercise_weight' ? 'kg' : kind === 'exercise_reps' ? 'reps' : kind === 'streak' ? 'weken' : 'per week'})</span>
          <NumberInput className="mt-1 h-11 text-left" value={target} onValue={setTarget} integer={kind !== 'bodyweight' && kind !== 'exercise_weight'} />
        </label>
        {kind === 'bodyweight' && (
          <label className="block">
            <span className="label">Startgewicht (kg)</span>
            <NumberInput className="mt-1 h-11 text-left" value={start} onValue={setStart} placeholder="eerste meting" />
          </label>
        )}
      </div>
      <label className="block">
        <span className="label">Titel (optioneel)</span>
        <input className="field mt-1" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="bv. 100 kg squat" />
      </label>
      <label className="block">
        <span className="label">Deadline (optioneel)</span>
        <input type="date" className="field mt-1" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" variant="primary" size="lg" block>
        Opslaan
      </Button>
    </form>
  );
}
