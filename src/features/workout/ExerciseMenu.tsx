import { useState } from 'react';
import { ArrowDown, ArrowUp, Link2, RefreshCw, Trash2 } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import type { WorkoutExercise } from '@/lib/db/types';

/** Opties voor één oefening in de lopende workout: verplaatsen, vervangen, superset, rusttijd, notitie, verwijderen. */
export function ExerciseMenu({
  we,
  isFirst,
  isLast,
  defaultRest,
  onClose,
  onMove,
  onReplace,
  onSuperset,
  onRemove,
  onNote,
  onRest,
}: {
  we: WorkoutExercise | null;
  isFirst: boolean;
  isLast: boolean;
  defaultRest: number;
  onClose: () => void;
  onMove: (d: -1 | 1) => void;
  onReplace: () => void;
  onSuperset: () => void;
  onRemove: () => void;
  onNote: (n: string | null) => void;
  onRest: (s: number) => void;
}) {
  return (
    <Sheet open={!!we} onClose={onClose} title={we?.exerciseName}>
      {we && <ExerciseMenuBody key={we.id} {...{ we, isFirst, isLast, defaultRest, onClose, onMove, onReplace, onSuperset, onRemove, onNote, onRest }} />}
    </Sheet>
  );
}

function ExerciseMenuBody({
  we,
  isFirst,
  isLast,
  defaultRest,
  onClose,
  onMove,
  onReplace,
  onSuperset,
  onRemove,
  onNote,
  onRest,
}: Omit<Parameters<typeof ExerciseMenu>[0], 'we'> & { we: WorkoutExercise }) {
  const [note, setNote] = useState(we.note ?? '');
  const [rest, setRest] = useState(String(defaultRest));
  const act = (fn: () => void) => () => (fn(), onClose());
  return (
    <div className="space-y-3 p-4">
      <div className="grid grid-cols-2 gap-2">
        <Button icon={<ArrowUp size={16} />} disabled={isFirst} onClick={act(() => onMove(-1))}>
          Omhoog
        </Button>
        <Button icon={<ArrowDown size={16} />} disabled={isLast} onClick={act(() => onMove(1))}>
          Omlaag
        </Button>
        <Button icon={<RefreshCw size={16} />} onClick={act(onReplace)}>
          Vervangen
        </Button>
        <Button icon={<Link2 size={16} />} disabled={isLast} onClick={act(onSuperset)}>
          {we.supersetGroup ? 'Superset aan/uit' : 'Superset met volgende'}
        </Button>
      </div>
      <label className="block">
        <span className="label">Rusttijd voor deze oefening (seconden)</span>
        <input className="field mt-1" inputMode="numeric" value={rest} onChange={(e) => setRest(e.target.value.replace(/\D/g, ''))} />
      </label>
      <label className="block">
        <span className="label">Notitie bij deze oefening</span>
        <textarea className="field mt-1" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <div className="flex gap-2">
        <Button variant="danger" icon={<Trash2 size={16} />} block onClick={act(onRemove)}>
          Verwijderen
        </Button>
        <Button
          variant="primary"
          block
          onClick={act(() => {
            onNote(note.trim() || null);
            const r = Number(rest);
            if (rest !== '' && r !== defaultRest && r >= 0 && r <= 1800) onRest(r);
          })}
        >
          Bewaren
        </Button>
      </div>
    </div>
  );
}
