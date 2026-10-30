import { useEffect, useState, type FormEvent } from 'react';
import { z } from 'zod';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { EQUIPMENT, EXERCISE_TYPES, MUSCLES, type Exercise, type Muscle } from '@/lib/db/types';
import { EQUIPMENT_LABELS, MUSCLE_LABELS, TYPE_LABELS } from '@/domain/exerciseTypes';
import { saveExercise } from '@/lib/db/repo';
import { requireUserId } from '@/lib/db/session';
import { newId } from '@/lib/ids';

const schema = z.object({
  name: z.string().trim().min(1, 'Naam is verplicht').max(120),
  primaryMuscle: z.enum(MUSCLES),
  secondaryMuscles: z.array(z.enum(MUSCLES)),
  equipment: z.enum(EQUIPMENT),
  type: z.enum(EXERCISE_TYPES),
  instructions: z.string().max(4000).nullable(),
  notes: z.string().max(4000).nullable(),
});

/** Eigen oefening aanmaken of bewerken. Standaardoefeningen zijn niet bewerkbaar. */
export function ExerciseForm({
  open,
  onClose,
  exercise,
  initialName = '',
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  exercise?: Exercise;
  initialName?: string;
  onSaved?: (e: Exercise) => void;
}) {
  const [form, setForm] = useState(() => toForm(exercise, initialName));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(toForm(exercise, initialName));
      setError(null);
    }
  }, [open, exercise, initialName]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ ...form, instructions: form.instructions || null, notes: form.notes || null });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Ongeldige invoer');
    setBusy(true);
    try {
      const ex: Exercise = {
        id: exercise?.id ?? newId(),
        userId: requireUserId(),
        imagePath: exercise?.imagePath ?? null,
        serverUpdatedAt: exercise?.serverUpdatedAt ?? null,
        deletedAt: null,
        ...parsed.data,
        secondaryMuscles: parsed.data.secondaryMuscles.filter((m) => m !== parsed.data.primaryMuscle),
      };
      await saveExercise(ex);
      onSaved?.(ex);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const toggleSecondary = (m: Muscle) =>
    setForm((f) => ({ ...f, secondaryMuscles: f.secondaryMuscles.includes(m) ? f.secondaryMuscles.filter((x) => x !== m) : [...f.secondaryMuscles, m] }));

  return (
    <Sheet open={open} onClose={onClose} title={exercise ? 'Oefening bewerken' : 'Nieuwe oefening'}>
      <form onSubmit={submit} className="space-y-4 p-4">
        <label className="block">
          <span className="label">Naam</span>
          <input className="field mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="bv. Bench Press (Dumbbell)" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label">Spiergroep</span>
            <select className="field mt-1" value={form.primaryMuscle} onChange={(e) => setForm({ ...form, primaryMuscle: e.target.value as Muscle })}>
              {MUSCLES.map((m) => (
                <option key={m} value={m}>
                  {MUSCLE_LABELS[m]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">Materiaal</span>
            <select className="field mt-1" value={form.equipment} onChange={(e) => setForm({ ...form, equipment: e.target.value as Exercise['equipment'] })}>
              {EQUIPMENT.map((m) => (
                <option key={m} value={m}>
                  {EQUIPMENT_LABELS[m]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="label">Type (wat registreer je?)</span>
          <select className="field mt-1" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Exercise['type'] })}>
            {EXERCISE_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          {exercise && exercise.type !== form.type && (
            <span className="mt-1 block text-xs text-warn">Let op: records worden per type berekend. Oude sets houden hun oorspronkelijke type.</span>
          )}
        </label>
        <fieldset>
          <legend className="label">Secundaire spiergroepen</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {MUSCLES.filter((m) => m !== form.primaryMuscle).map((m) => (
              <button
                type="button"
                key={m}
                onClick={() => toggleSecondary(m)}
                aria-pressed={form.secondaryMuscles.includes(m)}
                className={`min-h-[36px] rounded-full border px-3 text-sm ${form.secondaryMuscles.includes(m) ? 'border-accent bg-accent text-accent-ink' : 'border-line text-muted hover:border-accent'}`}
              >
                {MUSCLE_LABELS[m]}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="block">
          <span className="label">Instructies</span>
          <textarea className="field mt-1 min-h-[80px]" value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
        </label>
        <label className="block">
          <span className="label">Persoonlijke notities</span>
          <textarea className="field mt-1 min-h-[60px]" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" variant="primary" size="lg" block loading={busy}>
          Opslaan
        </Button>
      </form>
    </Sheet>
  );
}

function toForm(e: Exercise | undefined, name: string) {
  return {
    name: e?.name ?? name,
    primaryMuscle: e?.primaryMuscle ?? ('chest' as Muscle),
    secondaryMuscles: e?.secondaryMuscles ?? ([] as Muscle[]),
    equipment: e?.equipment ?? ('machine' as Exercise['equipment']),
    type: e?.type ?? ('weight_reps' as Exercise['type']),
    instructions: e?.instructions ?? '',
    notes: e?.notes ?? '',
  };
}
