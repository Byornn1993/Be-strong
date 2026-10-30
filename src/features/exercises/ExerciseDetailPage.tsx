import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import { PageHeader, Tabs } from '@/components/ui/PageHeader';
import { Button, IconButton } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState, Spinner } from '@/components/ui/States';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { ExerciseAvatar } from '@/components/ExerciseAvatar';
import { TrendChart } from '@/components/charts';
import { useExercise, useExercisePref, useWorkouts } from '@/lib/db/hooks';
import { deleteExercise, saveExercisePref } from '@/lib/db/repo';
import { EQUIPMENT_LABELS, MUSCLE_LABELS, TYPE_LABELS } from '@/domain/exerciseTypes';
import { exerciseSessions } from '@/domain/exerciseHistory';
import { computeRecords, PR_LABELS } from '@/domain/prs';
import { formatDate, formatShortDate } from '@/domain/dates';
import { formatNumber, formatSet, formatVolume, formatClock, formatDistance } from '@/domain/format';
import { ExerciseForm } from './ExerciseForm';

type Tab = 'about' | 'history' | 'charts' | 'records';

export default function ExerciseDetailPage() {
  const { id } = useParams();
  const ex = useExercise(id);
  const workouts = useWorkouts();
  const pref = useExercisePref(id);
  const navigate = useNavigate();
  const { confirm, dialog } = useConfirm();
  const [tab, setTab] = useState<Tab>('about');
  const [editing, setEditing] = useState(false);

  const sessions = useMemo(() => (workouts && id ? exerciseSessions(workouts, id) : []), [workouts, id]);
  const records = useMemo(
    () => (workouts && ex ? computeRecords(workouts, { exerciseId: ex.id, exerciseName: ex.name, type: ex.type }) : null),
    [workouts, ex],
  );

  if (ex === undefined || !workouts) return <Spinner />;
  if (!ex) return <EmptyState title="Oefening niet gevonden" />;

  const remove = async () => {
    const used = sessions.length;
    const ok = await confirm({
      title: `“${ex.name}” verwijderen?`,
      message: used
        ? `Deze oefening komt voor in ${used} workout${used > 1 ? 's' : ''}. Je geschiedenis blijft bewaard (met de naam van toen), maar de oefening verdwijnt uit de bibliotheek.`
        : 'De oefening verdwijnt uit je bibliotheek.',
      confirmLabel: 'Verwijderen',
      danger: true,
    });
    if (ok) {
      await deleteExercise(ex.id);
      navigate('/exercises');
    }
  };

  const chrono = [...sessions].reverse();

  return (
    <div>
      <PageHeader
        title={ex.name}
        back="/exercises"
        actions={
          ex.userId && (
            <>
              <IconButton label="Bewerken" onClick={() => setEditing(true)}>
                <Pencil size={20} />
              </IconButton>
              <IconButton label="Verwijderen" onClick={remove}>
                <Trash2 size={20} />
              </IconButton>
            </>
          )
        }
      />
      <div className="space-y-4 px-4 desk:px-0">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'about', label: 'Info' },
            { value: 'history', label: 'Geschiedenis' },
            { value: 'charts', label: 'Grafieken' },
            { value: 'records', label: 'Records' },
          ]}
        />

        {tab === 'about' && (
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-4">
              <div className="flex items-center gap-4">
                <ExerciseAvatar name={ex.name} muscle={ex.primaryMuscle} size={72} />
                <div className="text-sm">
                  <p>
                    <span className="text-muted">Spiergroep:</span> {MUSCLE_LABELS[ex.primaryMuscle]}
                  </p>
                  {ex.secondaryMuscles.length > 0 && (
                    <p>
                      <span className="text-muted">Secundair:</span> {ex.secondaryMuscles.map((m) => MUSCLE_LABELS[m]).join(', ')}
                    </p>
                  )}
                  <p>
                    <span className="text-muted">Materiaal:</span> {EQUIPMENT_LABELS[ex.equipment]}
                  </p>
                  <p>
                    <span className="text-muted">Type:</span> {TYPE_LABELS[ex.type]}
                  </p>
                  <p className="mt-1 text-xs text-faint">{ex.userId ? 'Eigen oefening' : 'Standaardoefening'}</p>
                </div>
              </div>
              {ex.instructions && <p className="mt-4 whitespace-pre-line text-sm text-muted">{ex.instructions}</p>}
              {ex.notes && <p className="mt-3 whitespace-pre-line text-sm">{ex.notes}</p>}
            </Card>
            <PrefCard key={pref?.id ?? 'new'} exerciseId={ex.id} notes={pref?.notes ?? ''} restSec={pref?.restSec ?? null} />
          </div>
        )}

        {tab === 'history' &&
          (sessions.length === 0 ? (
            <EmptyState title="Nog niet gedaan" text="Zodra je deze oefening logt, verschijnen je sets hier." />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {sessions.map((s) => (
                <Link key={s.workoutId} to={`/history/${s.workoutId}`} className="card block p-4 hover:border-accent/40">
                  <p className="font-semibold">{s.workoutName}</p>
                  <p className="text-xs text-muted">{formatDate(s.startedAt)}</p>
                  <ol className="mt-2 space-y-0.5 text-sm">
                    {s.sets.map((set, i) => (
                      <li key={set.id} className="flex gap-3">
                        <span className="w-5 text-faint">{set.type === 'warmup' ? 'W' : i + 1}</span>
                        {formatSet(ex.type, set)}
                      </li>
                    ))}
                  </ol>
                </Link>
              ))}
            </div>
          ))}

        {tab === 'charts' &&
          (chrono.length < 2 ? (
            <EmptyState title="Nog te weinig data" text="Na twee sessies zie je hier je evolutie." />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {chrono.some((s) => s.heaviest) && (
                <Card>
                  <CardHeader title="Zwaarste gewicht" />
                  <div className="p-2">
                    <TrendChart unit="kg" data={chrono.map((s) => ({ label: formatShortDate(s.startedAt), value: s.heaviest }))} />
                  </div>
                </Card>
              )}
              {chrono.some((s) => s.e1rm) && (
                <Card>
                  <CardHeader title="Geschatte 1RM" subtitle="Schatting volgens Epley (1–12 reps)" />
                  <div className="p-2">
                    <TrendChart unit="kg" data={chrono.map((s) => ({ label: formatShortDate(s.startedAt), value: s.e1rm ? Math.round(s.e1rm * 10) / 10 : null }))} />
                  </div>
                </Card>
              )}
              {chrono.some((s) => s.volume) && (
                <Card>
                  <CardHeader title="Volume per sessie" />
                  <div className="p-2">
                    <TrendChart unit="kg" data={chrono.map((s) => ({ label: formatShortDate(s.startedAt), value: s.volume }))} />
                  </div>
                </Card>
              )}
            </div>
          ))}

        {tab === 'records' && records && (
          <Card className="divide-y divide-border">
            {[
              ['heaviestWeight', records.heaviestWeight, (v: number) => `${formatNumber(v)} kg`],
              ['estimated1RM', records.estimated1RM, (v: number) => `${formatNumber(Math.round(v * 10) / 10)} kg`],
              ['bestSetVolume', records.bestSetVolume, formatVolume],
              ['bestSessionVolume', records.bestSessionVolume, formatVolume],
              ['longestDuration', records.longestDuration, formatClock],
              ['longestDistance', records.longestDistance, formatDistance],
            ]
              .filter(([, v]) => v !== null)
              .map(([k, v, f]) => (
                <div key={k as string} className="flex justify-between p-4 text-sm">
                  <span className="text-muted">{PR_LABELS[k as keyof typeof PR_LABELS]}</span>
                  <span className="font-semibold">{(f as (n: number) => string)(v as number)}</span>
                </div>
              ))}
            {records.repsAtWeight.size > 0 && (
              <div className="p-4 text-sm">
                <p className="text-muted">Meeste reps per gewicht</p>
                <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {[...records.repsAtWeight.entries()]
                    .sort((a, b) => b[0] - a[0])
                    .slice(0, 15)
                    .map(([w, r]) => (
                      <div key={w} className="rounded-lg bg-surface-2 p-2 text-center">
                        <p className="font-semibold">{r} reps</p>
                        <p className="text-xs text-muted">{w ? `${formatNumber(w)} kg` : 'lichaamsgewicht'}</p>
                      </div>
                    ))}
                </div>
              </div>
            )}
            {records.heaviestWeight === null && records.repsAtWeight.size === 0 && records.longestDuration === null && records.longestDistance === null && (
              <EmptyState title="Nog geen records" text="Warm-up-sets tellen niet mee." />
            )}
          </Card>
        )}
      </div>
      <ExerciseForm open={editing} onClose={() => setEditing(false)} exercise={ex} />
      {dialog}
    </div>
  );
}

function PrefCard({ exerciseId, notes, restSec }: { exerciseId: string; notes: string; restSec: number | null }) {
  const [n, setN] = useState(notes);
  const [r, setR] = useState(restSec === null ? '' : String(restSec));
  const [saved, setSaved] = useState(false);
  return (
    <Card className="space-y-3 p-4">
      <p className="font-semibold">Mijn instellingen</p>
      <label className="block">
        <span className="label">Rusttijd (seconden)</span>
        <input className="field mt-1" inputMode="numeric" placeholder="standaard" value={r} onChange={(e) => (setR(e.target.value.replace(/\D/g, '')), setSaved(false))} />
      </label>
      <label className="block">
        <span className="label">Persoonlijke notities</span>
        <textarea className="field mt-1 min-h-[80px]" value={n} onChange={(e) => (setN(e.target.value), setSaved(false))} placeholder="bv. stoel op stand 4" />
      </label>
      <Button
        variant="primary"
        onClick={async () => {
          await saveExercisePref(exerciseId, { notes: n.trim() || null, restSec: r === '' ? null : Math.min(1800, Number(r)) });
          setSaved(true);
        }}
      >
        {saved ? 'Bewaard ✓' : 'Bewaren'}
      </Button>
    </Card>
  );
}
