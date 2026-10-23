import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Stat } from '@/components/ui/Card';
import type { ActiveWorkout, Template, Workout } from '@/lib/db/types';
import { detectNewPrs, PR_LABELS, type NewPr } from '@/domain/prs';
import { completedSetCount, workoutVolume } from '@/domain/volume';
import { formatDuration, formatNumber, formatVolume } from '@/domain/format';
import { saveTemplate } from '@/lib/db/repo';
import { countSets, differsFromTemplate, templateFromWorkout, toFinishedWorkout } from './logic';
import { finishActive } from './activeStore';
import { useActiveWorkout } from './WorkoutProvider';

export function formatPr(p: NewPr): string {
  const unit = p.kind === 'repsAtWeight' ? ' reps' : p.kind === 'longestDuration' ? ' s' : p.kind === 'longestDistance' ? ' m' : ' kg';
  const at = p.kind === 'repsAtWeight' && p.atWeight ? ` @ ${formatNumber(p.atWeight)} kg` : '';
  return `${formatNumber(p.value)}${unit}${at} (was ${formatNumber(p.previous)})`;
}

export function FinishSheet({
  open,
  onClose,
  active,
  history,
  template,
}: {
  open: boolean;
  onClose: () => void;
  active: ActiveWorkout;
  history: Workout[];
  template: Template | null;
}) {
  const navigate = useNavigate();
  const { flush, clearAfterFinish } = useActiveWorkout();
  const [note, setNote] = useState(active.note ?? '');
  const [keepUnchecked, setKeepUnchecked] = useState(false);
  const [updateTemplate, setUpdateTemplate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const counts = countSets(active);
  const preview = useMemo(() => toFinishedWorkout(active, { keepUnchecked, note: null }, new Date()), [active, keepUnchecked]);
  const prs = useMemo(() => detectNewPrs(preview, history), [preview, history]);
  const changed = template ? differsFromTemplate(preview, template) : false;

  const finish = async () => {
    if (busy) return; // dubbel tikken
    setBusy(true);
    setError(null);
    try {
      await flush();
      const w = await finishActive(active.id, { keepUnchecked, note: note.trim() || null });
      if (template && changed && updateTemplate) await saveTemplate(templateFromWorkout(template, w));
      clearAfterFinish();
      navigate(`/history/${w.id}?finished=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const empty = completedSetCount(preview) === 0;

  return (
    <Sheet open={open} onClose={onClose} title="Workout afronden">
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Duur" value={formatDuration(preview.durationSec)} />
          <Stat label="Oefeningen" value={preview.exercises.length} />
          <Stat label="Sets voltooid" value={counts.done} />
          <Stat label="Volume" value={formatVolume(workoutVolume(preview))} />
        </div>

        {prs.length > 0 && (
          <div className="rounded-card border border-accent/30 bg-primary-soft p-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-accent">
              <Trophy size={16} /> {prs.length} nieuw{prs.length > 1 ? 'e' : ''} PR{prs.length > 1 ? "'s" : ''}
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              {prs.map((p, i) => (
                <li key={i}>
                  <span className="font-medium">{p.exerciseName}</span> · <span className="text-muted">{PR_LABELS[p.kind]}:</span> {formatPr(p)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {counts.open > 0 && (
          <fieldset className="card p-3">
            <legend className="sr-only">Niet-afgevinkte sets</legend>
            <p className="text-sm font-medium">{counts.open} set{counts.open > 1 ? 's' : ''} niet afgevinkt</p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" block variant={!keepUnchecked ? 'primary' : 'secondary'} onClick={() => setKeepUnchecked(false)}>
                Weggooien
              </Button>
              <Button size="sm" block variant={keepUnchecked ? 'primary' : 'secondary'} onClick={() => setKeepUnchecked(true)}>
                Behouden
              </Button>
            </div>
          </fieldset>
        )}

        {template && changed && (
          <label className="card flex min-h-[52px] items-center gap-3 p-3">
            <input type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={updateTemplate} onChange={(e) => setUpdateTemplate(e.target.checked)} />
            <span className="text-sm">
              Template “{template.name}” bijwerken met deze workout?
              <span className="block text-xs text-muted">Je hebt oefeningen of sets gewijzigd t.o.v. de template.</span>
            </span>
          </label>
        )}

        <label className="block">
          <span className="label">Notities (optioneel)</span>
          <textarea className="field mt-1 min-h-[70px]" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Hoe ging het?" />
        </label>

        {empty && <p className="text-sm text-warn">Er is nog geen enkele set afgevinkt. Vink sets af of kies “Behouden”.</p>}
        {error && <p className="text-sm text-danger">{error}</p>}

        <Button variant="primary" size="lg" block loading={busy} disabled={empty} onClick={finish}>
          Workout opslaan
        </Button>
      </div>
    </Sheet>
  );
}
