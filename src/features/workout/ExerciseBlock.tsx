import { useState } from 'react';
import { Link2, MoreHorizontal, Plus } from 'lucide-react';
import type { RestTimerState, SetType, WorkoutExercise, WorkoutSet } from '@/lib/db/types';
import { previousForIndex } from '@/domain/previous';
import { columnsFor, SET_TYPE_LABELS } from '@/domain/exerciseTypes';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { SetRow } from './SetRow';
import { RestBar } from './RestTimer';

export interface ExerciseActions {
  onSetChange: (setId: string, patch: Partial<WorkoutSet>) => void;
  onToggle: (setId: string) => void;
  onAddSet: () => void;
  onRemoveSet: (setId: string) => void;
  onMenu: () => void;
  onRestChange: (r: RestTimerState | null) => void;
}

export function ExerciseBlock({
  we,
  previous,
  rest,
  now,
  supersetLabel,
  actions,
}: {
  we: WorkoutExercise;
  previous: WorkoutSet[];
  rest: RestTimerState | null;
  now: number;
  supersetLabel: string | null;
  actions: ExerciseActions;
}) {
  const [setMenu, setSetMenu] = useState<WorkoutSet | null>(null);
  const cols = columnsFor(we.exerciseType);
  let normal = 0;

  return (
    <section className={`relative px-3 py-3 ${supersetLabel ? 'border-l-2 border-accent/70 pl-3' : ''}`} aria-label={we.exerciseName}>
      <div className="mb-1 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          {supersetLabel && (
            <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-accent">
              <Link2 size={12} /> {supersetLabel}
            </p>
          )}
          <h3 className="truncate text-[17px] font-semibold text-accent">{we.exerciseName}</h3>
          {we.note && <p className="mt-0.5 text-xs text-muted">{we.note}</p>}
        </div>
        <button type="button" onClick={actions.onMenu} className="tap flex items-center justify-center rounded-lg bg-surface-2 text-muted hover:text-text" aria-label={`Opties voor ${we.exerciseName}`}>
          <MoreHorizontal size={20} />
        </button>
      </div>

      <div
        className="grid gap-1.5 px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-faint"
        style={{ gridTemplateColumns: `40px minmax(0,1fr) ${cols.map(() => 'minmax(56px,72px)').join(' ')} 44px` }}
        aria-hidden
      >
        <span className="text-center">Set</span>
        <span>Vorige</span>
        {cols.map((c) => (
          <span key={c.field} className="text-center">
            {c.label}
          </span>
        ))}
        <span className="text-center">✓</span>
      </div>

      <div className="space-y-1">
        {we.sets.map((s, i) => {
          if (s.type !== 'warmup') normal++;
          return (
            <div key={s.id}>
              <SetRow
                type={we.exerciseType}
                set={s}
                normalIndex={normal}
                previous={previousForIndex(previous, i)}
                onChange={(p) => actions.onSetChange(s.id, p)}
                onToggle={() => actions.onToggle(s.id)}
                onBadge={() => setSetMenu(s)}
              />
              {s.note && <p className="px-12 pb-1 text-xs text-muted">📝 {s.note}</p>}
              {rest && rest.afterSetId === s.id && rest.endsAt > now && <RestBar rest={rest} now={now} onChange={actions.onRestChange} />}
            </div>
          );
        })}
      </div>

      <Button size="sm" variant="ghost" block className="mt-1 text-muted" icon={<Plus size={16} />} onClick={actions.onAddSet}>
        Set toevoegen
      </Button>

      <SetMenu
        set={setMenu}
        onClose={() => setSetMenu(null)}
        onType={(t) => setMenu && actions.onSetChange(setMenu.id, { type: t })}
        onNote={(note) => setMenu && actions.onSetChange(setMenu.id, { note })}
        onRemove={() => setMenu && actions.onRemoveSet(setMenu.id)}
      />
    </section>
  );
}

function SetMenu({
  set,
  onClose,
  onType,
  onNote,
  onRemove,
}: {
  set: WorkoutSet | null;
  onClose: () => void;
  onType: (t: SetType) => void;
  onNote: (n: string | null) => void;
  onRemove: () => void;
}) {
  return (
    <Sheet open={!!set} onClose={onClose} title="Set">
      {set && <SetMenuBody key={set.id} set={set} onClose={onClose} onType={onType} onNote={onNote} onRemove={onRemove} />}
    </Sheet>
  );
}

function SetMenuBody({
  set,
  onClose,
  onType,
  onNote,
  onRemove,
}: {
  set: WorkoutSet;
  onClose: () => void;
  onType: (t: SetType) => void;
  onNote: (n: string | null) => void;
  onRemove: () => void;
}) {
  const [note, setNote] = useState(set.note ?? '');
  return (
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(SET_TYPE_LABELS) as SetType[]).map((t) => (
              <Button key={t} variant={set.type === t ? 'primary' : 'secondary'} onClick={() => (onType(t), onClose())}>
                {SET_TYPE_LABELS[t]}
              </Button>
            ))}
          </div>
          <label className="block">
            <span className="label">Notitie bij deze set</span>
            <textarea className="field mt-1" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div className="flex gap-2">
            <Button variant="danger" block onClick={() => (onRemove(), onClose())}>
              Set verwijderen
            </Button>
            <Button variant="primary" block onClick={() => (onNote(note.trim() || null), onClose())}>
              Notitie bewaren
            </Button>
          </div>
        </div>
  );
}
