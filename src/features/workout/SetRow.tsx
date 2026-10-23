import { Check } from 'lucide-react';
import type { ExerciseType, SetValues, WorkoutSet } from '@/lib/db/types';
import { columnsFor, setBadge } from '@/domain/exerciseTypes';
import { formatSet } from '@/domain/format';
import { DurationInput, NumberInput } from '@/components/ui/NumberInput';

export const setInputId = (setId: string) => `set-in-${setId}`;

const badgeColor: Record<WorkoutSet['type'], string> = {
  normal: 'text-text',
  warmup: 'text-warn',
  drop: 'text-[#c39bff]',
  failure: 'text-danger',
};

/** Eén rij: Set | Previous | kg | Reps | ✓  (kolommen volgens het oefeningtype). */
export function SetRow({
  type,
  set,
  normalIndex,
  previous,
  onChange,
  onToggle,
  onBadge,
}: {
  type: ExerciseType;
  set: WorkoutSet;
  normalIndex: number;
  previous: SetValues | null;
  onChange: (patch: Partial<WorkoutSet>) => void;
  onToggle: () => void;
  onBadge: () => void;
}) {
  const cols = columnsFor(type);
  const done = set.completed;
  return (
    <div
      className={`grid items-center gap-1.5 rounded-xl px-1 py-1 transition-colors ${done ? 'bg-accent/15' : ''}`}
      style={{ gridTemplateColumns: `40px minmax(0,1fr) ${cols.map(() => 'minmax(56px,72px)').join(' ')} 44px` }}
    >
      <button type="button" onClick={onBadge} className={`tap -my-1 rounded-lg text-sm font-bold ${badgeColor[set.type]}`} aria-label={`Set ${normalIndex}, type wijzigen`}>
        {setBadge(set.type, normalIndex)}
      </button>
      <button
        type="button"
        disabled={!previous}
        onClick={() => previous && onChange({ ...previous })}
        className="min-h-[40px] truncate rounded-lg px-1 text-left text-[13px] text-muted enabled:hover:text-text disabled:text-faint"
        aria-label={previous ? `Vorige: ${formatSet(type, previous)} overnemen` : 'Geen vorige waarde'}
      >
        {previous ? formatSet(type, previous) : '—'}
      </button>
      {cols.map((c, i) =>
        c.field === 'durationSec' ? (
          <DurationInput
            key={c.field}
            id={i === 0 ? setInputId(set.id) : undefined}
            aria-label={c.label}
            value={set.durationSec}
            placeholder={previous?.durationSec ? `${Math.floor(previous.durationSec / 60)}:${String(previous.durationSec % 60).padStart(2, '0')}` : '0:00'}
            onValue={(v) => onChange({ durationSec: v })}
            className={done ? 'bg-transparent' : ''}
          />
        ) : (
          <NumberInput
            key={c.field}
            id={i === 0 ? setInputId(set.id) : undefined}
            aria-label={c.label}
            integer={c.field === 'reps'}
            value={set[c.field]}
            placeholder={previous?.[c.field] != null ? String(previous[c.field]).replace('.', ',') : c.field === 'reps' ? '0' : '0'}
            onValue={(v) => onChange({ [c.field]: v })}
            className={done ? 'bg-transparent' : ''}
          />
        ),
      )}
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={done}
        aria-label={done ? 'Set niet meer afgevinkt' : 'Set afvinken'}
        className={`tap flex h-10 items-center justify-center rounded-lg transition ${done ? 'anim-pop bg-accent text-accent-ink' : 'bg-surface-2 text-faint hover:text-text'}`}
      >
        <Check size={20} strokeWidth={3} />
      </button>
    </div>
  );
}
