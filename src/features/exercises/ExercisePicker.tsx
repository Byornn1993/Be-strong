import { useMemo, useState } from 'react';
import { Check, Plus, Search } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/PageHeader';
import { ExerciseAvatar } from '@/components/ExerciseAvatar';
import { Spinner } from '@/components/ui/States';
import { useExercises } from '@/lib/db/hooks';
import { MUSCLES, type Exercise, type Muscle } from '@/lib/db/types';
import { MUSCLE_LABELS, EQUIPMENT_LABELS } from '@/domain/exerciseTypes';
import { ExerciseForm } from './ExerciseForm';

export function filterExercises(list: readonly Exercise[], q: string, muscle: Muscle | null): Exercise[] {
  const terms = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return list.filter(
    (e) =>
      (!muscle || e.primaryMuscle === muscle || e.secondaryMuscles.includes(muscle)) &&
      terms.every((t) => e.name.toLowerCase().includes(t) || EQUIPMENT_LABELS[e.equipment].toLowerCase().includes(t)),
  );
}

/** Zoeken in de bibliotheek en één of meer oefeningen kiezen. */
export function ExercisePicker({
  open,
  onClose,
  onPick,
  multi = true,
  title = 'Oefening toevoegen',
}: {
  open: boolean;
  onClose: () => void;
  onPick: (exercises: Exercise[]) => void;
  multi?: boolean;
  title?: string;
}) {
  const all = useExercises();
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<Muscle | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const list = useMemo(() => (all ? filterExercises(all, q, muscle) : []), [all, q, muscle]);

  const done = (ids = selected) => {
    if (!all) return;
    const byId = new Map(all.map((e) => [e.id, e]));
    onPick(ids.map((id) => byId.get(id)!).filter(Boolean));
    setSelected([]);
    setQ('');
    onClose();
  };

  const toggle = (id: string) => {
    if (!multi) return done([id]);
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      action={
        <Button size="sm" variant="ghost" icon={<Plus size={16} />} onClick={() => setCreating(true)}>
          Nieuw
        </Button>
      }
      footer={
        multi && (
          <Button variant="primary" size="lg" block disabled={selected.length === 0} onClick={() => done()}>
            {selected.length ? `Voeg ${selected.length} toe` : 'Kies oefeningen'}
          </Button>
        )
      }
    >
      <div className="sticky top-0 z-10 space-y-2 bg-surface p-3">
        <label className="relative block">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input className="field pl-10" placeholder="Zoek oefening" value={q} onChange={(e) => setQ(e.target.value)} autoFocus={window.matchMedia('(pointer: fine)').matches} />
        </label>
        <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1">
          <Chip active={!muscle} onClick={() => setMuscle(null)}>
            Alles
          </Chip>
          {MUSCLES.map((m) => (
            <Chip key={m} active={muscle === m} onClick={() => setMuscle(muscle === m ? null : m)}>
              {MUSCLE_LABELS[m]}
            </Chip>
          ))}
        </div>
      </div>
      {!all ? (
        <Spinner />
      ) : list.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted">Geen oefeningen gevonden. Maak er een aan met “Nieuw”.</p>
      ) : (
        <ul className="px-2 pb-3">
          {list.map((e) => {
            const on = selected.includes(e.id);
            return (
              <li key={e.id}>
                <button type="button" onClick={() => toggle(e.id)} className={`flex min-h-[56px] w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left ${on ? 'bg-primary-soft' : 'hover:bg-surface-2'}`}>
                  <ExerciseAvatar name={e.name} muscle={e.primaryMuscle} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium">{e.name}</span>
                    <span className="block text-xs text-muted">
                      {MUSCLE_LABELS[e.primaryMuscle]}
                      {e.userId && ' · eigen'}
                    </span>
                  </span>
                  {on && <Check size={20} className="text-accent" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <ExerciseForm
        open={creating}
        onClose={() => setCreating(false)}
        initialName={q}
        onSaved={(ex) => {
          setCreating(false);
          if (multi) setSelected((s) => [...s, ex.id]);
          else done([ex.id]);
        }}
      />
    </Sheet>
  );
}
