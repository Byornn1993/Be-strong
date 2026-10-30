import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Link2, Minus, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button, IconButton } from '@/components/ui/Button';
import { NumberInput } from '@/components/ui/NumberInput';
import { EmptyState, Spinner } from '@/components/ui/States';
import { SortableList } from '@/components/SortableList';
import { ExercisePicker } from '@/features/exercises/ExercisePicker';
import { useExerciseMap, useTemplate, useTemplates } from '@/lib/db/hooks';
import { saveTemplate } from '@/lib/db/repo';
import type { Exercise, Template, TemplateExercise, TemplateSet } from '@/lib/db/types';
import { newId } from '@/lib/ids';
import { reorderExercises, toggleSupersetWithNext } from './logic';

const blankSet = (reps: number | null, weightKg: number | null): TemplateSet => ({ id: newId(), type: 'normal', reps, weightKg, durationSec: null, distanceM: null });

function setCount(te: TemplateExercise, n: number): TemplateExercise {
  const first = te.sets[0];
  const sets = te.sets.slice(0, n);
  while (sets.length < n) sets.push(blankSet(first?.reps ?? null, first?.weightKg ?? null));
  return { ...te, sets };
}

export default function TemplateEditorPage() {
  const { id } = useParams();
  const isNew = !id;
  const existing = useTemplate(id);
  const all = useTemplates();
  const exercises = useExerciseMap();
  const navigate = useNavigate();
  const [t, setT] = useState<Template | null>(null);
  const [picker, setPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (t) return;
    if (isNew)
      setT({ id: newId(), name: '', folder: null, note: null, sortOrder: all?.length ?? 0, exercises: [], serverUpdatedAt: null, deletedAt: null });
    else if (existing) setT(structuredClone(existing));
  }, [isNew, existing, all, t]);

  if (!isNew && existing === undefined) return <Spinner />;
  if (!isNew && (existing === null || existing?.deletedAt)) return <EmptyState title="Template niet gevonden" />;
  if (!t || !exercises) return <Spinner />;

  const patchEx = (teId: string, fn: (te: TemplateExercise) => TemplateExercise) => setT({ ...t, exercises: t.exercises.map((x) => (x.id === teId ? fn(x) : x)) });

  const add = (list: Exercise[]) =>
    setT({
      ...t,
      exercises: [
        ...t.exercises,
        ...list.map((ex): TemplateExercise => ({ id: newId(), exerciseId: ex.id, supersetGroup: null, restSec: null, note: null, sets: [0, 1, 2].map(() => blankSet(10, null)) })),
      ],
    });

  const save = async () => {
    if (!t.name.trim()) return setError('Geef de template een naam.');
    if (t.exercises.length === 0) return setError('Voeg minstens één oefening toe.');
    setSaving(true);
    await saveTemplate({ ...t, name: t.name.trim(), folder: t.folder?.trim() || null, note: t.note?.trim() || null });
    navigate('/workout');
  };

  return (
    <div>
      <PageHeader
        title={isNew ? 'Nieuwe template' : 'Template bewerken'}
        subtitle="Wijzigingen gelden voor toekomstige workouts, niet voor je geschiedenis."
        back
        actions={
          <Button variant="primary" onClick={save} loading={saving}>
            Opslaan
          </Button>
        }
      />
      <div className="space-y-4 px-4 desk:px-0">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">Naam</span>
            <input className="field mt-1" value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} placeholder="bv. Upper" />
          </label>
          <label className="block">
            <span className="label">Map (optioneel)</span>
            <input className="field mt-1" value={t.folder ?? ''} onChange={(e) => setT({ ...t, folder: e.target.value })} placeholder="bv. Schema najaar" />
          </label>
        </div>
        <label className="block">
          <span className="label">Notities</span>
          <textarea className="field mt-1" value={t.note ?? ''} onChange={(e) => setT({ ...t, note: e.target.value })} />
        </label>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="space-y-2">
          <SortableList
            items={t.exercises}
            onReorder={(from, to) => setT({ ...t, exercises: reorderExercises(t.exercises, from, to) })}
            render={(te, handle) => {
              const ex = exercises.get(te.exerciseId);
              const idx = t.exercises.indexOf(te);
              return (
                <div className={`card mb-2 p-3 ${te.supersetGroup ? 'border-l-2 border-l-accent/70' : ''}`}>
                  <div className="flex items-center gap-1">
                    {handle}
                    <p className="min-w-0 flex-1 truncate font-semibold">{ex?.name ?? 'Onbekende oefening'}</p>
                    <IconButton label="Superset met volgende" disabled={idx === t.exercises.length - 1} onClick={() => setT({ ...t, exercises: toggleSupersetWithNext(t.exercises, te.id) })} className={te.supersetGroup ? 'text-accent' : ''}>
                      <Link2 size={18} />
                    </IconButton>
                    <IconButton label="Verwijderen" onClick={() => setT({ ...t, exercises: t.exercises.filter((x) => x.id !== te.id) })}>
                      <Trash2 size={18} />
                    </IconButton>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div>
                      <span className="label">Sets</span>
                      <div className="mt-1 flex items-center gap-1">
                        <IconButton label="Set minder" onClick={() => patchEx(te.id, (x) => setCount(x, Math.max(1, x.sets.length - 1)))}>
                          <Minus size={16} />
                        </IconButton>
                        <span className="w-6 text-center font-semibold tabular-nums">{te.sets.length}</span>
                        <IconButton label="Set meer" onClick={() => patchEx(te.id, (x) => setCount(x, Math.min(20, x.sets.length + 1)))}>
                          <Plus size={16} />
                        </IconButton>
                      </div>
                    </div>
                    <label>
                      <span className="label">Reps</span>
                      <NumberInput integer className="mt-1" value={te.sets[0]?.reps ?? null} onValue={(v) => patchEx(te.id, (x) => ({ ...x, sets: x.sets.map((s) => ({ ...s, reps: v })) }))} placeholder="—" />
                    </label>
                    <label>
                      <span className="label">Doel kg</span>
                      <NumberInput className="mt-1" value={te.sets[0]?.weightKg ?? null} onValue={(v) => patchEx(te.id, (x) => ({ ...x, sets: x.sets.map((s) => ({ ...s, weightKg: v })) }))} placeholder="—" />
                    </label>
                    <label>
                      <span className="label">Rust (s)</span>
                      <NumberInput integer className="mt-1" value={te.restSec} onValue={(v) => patchEx(te.id, (x) => ({ ...x, restSec: v === null ? null : Math.min(1800, v) }))} placeholder="std" />
                    </label>
                  </div>
                  <input className="field mt-2 py-2 text-sm" placeholder="Notitie (optioneel)" value={te.note ?? ''} onChange={(e) => patchEx(te.id, (x) => ({ ...x, note: e.target.value || null }))} />
                </div>
              );
            }}
          />
          <Button variant="secondary" size="lg" block icon={<Plus size={18} />} onClick={() => setPicker(true)}>
            Oefening toevoegen
          </Button>
        </div>
      </div>
      <ExercisePicker open={picker} onClose={() => setPicker(false)} onPick={add} />
    </div>
  );
}
