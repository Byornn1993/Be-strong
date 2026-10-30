import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { Chip, PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState, Spinner } from '@/components/ui/States';
import { ExerciseAvatar } from '@/components/ExerciseAvatar';
import { useExercises, useWorkouts } from '@/lib/db/hooks';
import { EQUIPMENT, EXERCISE_TYPES, MUSCLES, type Equipment, type ExerciseType, type Muscle } from '@/lib/db/types';
import { EQUIPMENT_LABELS, MUSCLE_LABELS, TYPE_LABELS } from '@/domain/exerciseTypes';
import { ExerciseForm } from './ExerciseForm';
import { filterExercises } from './ExercisePicker';

export default function ExercisesPage() {
  const all = useExercises();
  const workouts = useWorkouts();
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<Muscle | null>(null);
  const [equipment, setEquipment] = useState<Equipment | ''>('');
  const [type, setType] = useState<ExerciseType | ''>('');
  const [own, setOwn] = useState<'all' | 'own' | 'std'>('all');
  const [creating, setCreating] = useState(false);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of workouts ?? []) for (const we of w.exercises) if (we.exerciseId) m.set(we.exerciseId, (m.get(we.exerciseId) ?? 0) + 1);
    return m;
  }, [workouts]);

  const list = useMemo(
    () =>
      all
        ? filterExercises(all, q, muscle).filter(
            (e) => (!equipment || e.equipment === equipment) && (!type || e.type === type) && (own === 'all' || (own === 'own') === (e.userId !== null)),
          )
        : [],
    [all, q, muscle, equipment, type, own],
  );

  return (
    <div>
      <PageHeader
        title="Oefeningen"
        actions={
          <Button size="sm" variant="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>
            Nieuw
          </Button>
        }
      />
      <div className="sticky top-0 z-10 space-y-2 bg-bg/95 px-4 pb-2 pt-1 backdrop-blur desk:px-0">
        <label className="relative block">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input className="field pl-10" placeholder="Zoek op naam" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap desk:px-0">
          <Chip active={!muscle} onClick={() => setMuscle(null)}>
            Alle spiergroepen
          </Chip>
          {MUSCLES.map((m) => (
            <Chip key={m} active={muscle === m} onClick={() => setMuscle(muscle === m ? null : m)}>
              {MUSCLE_LABELS[m]}
            </Chip>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <select className="field py-2 text-sm" aria-label="Materiaal" value={equipment} onChange={(e) => setEquipment(e.target.value as Equipment | '')}>
            <option value="">Materiaal</option>
            {EQUIPMENT.map((x) => (
              <option key={x} value={x}>
                {EQUIPMENT_LABELS[x]}
              </option>
            ))}
          </select>
          <select className="field py-2 text-sm" aria-label="Type" value={type} onChange={(e) => setType(e.target.value as ExerciseType | '')}>
            <option value="">Type</option>
            {EXERCISE_TYPES.map((x) => (
              <option key={x} value={x}>
                {TYPE_LABELS[x]}
              </option>
            ))}
          </select>
          <select className="field py-2 text-sm" aria-label="Bron" value={own} onChange={(e) => setOwn(e.target.value as typeof own)}>
            <option value="all">Alle</option>
            <option value="std">Standaard</option>
            <option value="own">Eigen</option>
          </select>
        </div>
      </div>

      {!all ? (
        <Spinner />
      ) : list.length === 0 ? (
        <EmptyState title="Geen oefeningen gevonden" text="Pas je filters aan of maak een eigen oefening." />
      ) : (
        <ul className="grid gap-x-4 px-2 md:grid-cols-2 desk:px-0 xl:grid-cols-3">
          {list.map((e) => (
            <li key={e.id}>
              <Link to={`/exercises/${e.id}`} className="flex min-h-[60px] items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface">
                <ExerciseAvatar name={e.name} muscle={e.primaryMuscle} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{e.name}</span>
                  <span className="block text-xs text-muted">
                    {MUSCLE_LABELS[e.primaryMuscle]} · {EQUIPMENT_LABELS[e.equipment]}
                    {counts.get(e.id) ? ` · ${counts.get(e.id)}×` : ''}
                  </span>
                </span>
                {e.userId && <span className="rounded-md bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-accent">Eigen</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <ExerciseForm open={creating} onClose={() => setCreating(false)} initialName={q} />
    </div>
  );
}
