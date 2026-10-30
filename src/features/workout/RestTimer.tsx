import { useEffect, useRef } from 'react';
import { SkipForward, Timer } from 'lucide-react';
import type { RestTimerState } from '@/lib/db/types';
import { adjustRest, restProgress, restRemainingSec } from '@/domain/timer';
import { formatClock } from '@/domain/format';
import { beep, notifyRestDone, vibrate } from './alerts';

interface Props {
  rest: RestTimerState;
  now: number;
  onChange: (r: RestTimerState | null) => void;
}

function Controls({ rest, now, onChange, compact }: Props & { compact?: boolean }) {
  const btn = `tap rounded-lg bg-surface-2 px-2 text-sm font-semibold tabular-nums hover:bg-champ/[0.07] ${compact ? 'min-h-[40px]' : ''}`;
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" className={btn} onClick={() => onChange(adjustRest(rest, -15, Date.now()))} aria-label="15 seconden minder">
        −15s
      </button>
      <button type="button" className={btn} onClick={() => onChange(adjustRest(rest, 15, Date.now()))} aria-label="15 seconden meer">
        +15s
      </button>
      <button type="button" className={`${btn} text-accent`} onClick={() => onChange(null)} aria-label="Rust overslaan">
        <SkipForward size={18} />
      </button>
      <span className="sr-only">{formatClock(restRemainingSec(rest, now))} resterend</span>
    </div>
  );
}

/** Rustbalk tussen de sets. */
export function RestBar(props: Props) {
  const { rest, now } = props;
  const p = restProgress(rest, now);
  return (
    <div className="my-1 flex items-center gap-3 rounded-xl border border-accent/25 bg-primary-soft px-3 py-1.5" role="timer" aria-live="off">
      <div className="bar relative flex-1">
        <span className="absolute inset-y-0 left-0" style={{ width: `${(1 - p) * 100}%` }} />
      </div>
      <span className="w-12 text-right text-sm font-semibold tabular-nums text-accent">{formatClock(restRemainingSec(rest, now))}</span>
      <Controls {...props} compact />
    </div>
  );
}

/** Zwevende mini-timer onderaan het workoutscherm. */
export function FloatingRest(props: Props) {
  const { rest, now } = props;
  const p = restProgress(rest, now);
  return (
    <div className="pointer-events-auto mx-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-accent/50 bg-surface px-3 py-2 shadow-pop">
      <div className="relative flex h-11 w-11 items-center justify-center">
        <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
          <circle cx="18" cy="18" r="16" fill="none" stroke="var(--surface-2)" strokeWidth="3" />
          <circle cx="18" cy="18" r="16" fill="none" stroke="var(--accent)" strokeWidth="3" strokeDasharray={`${(1 - p) * 100.5} 100.5`} strokeLinecap="round" />
        </svg>
        <Timer size={16} className="text-accent" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wide text-muted">Rust</p>
        <p className="text-xl font-bold tabular-nums leading-tight">{formatClock(restRemainingSec(rest, now))}</p>
      </div>
      <Controls {...props} />
    </div>
  );
}

/**
 * Plant het eindsignaal op basis van de eind-timestamp. Bij terugkeren naar de app (of na een refresh)
 * wordt opnieuw gerekend; een al verlopen rust wordt meteen afgesloten.
 */
export function useRestAlarm(rest: RestTimerState | null, onDone: () => void) {
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (!rest) return;
    const fire = () => {
      vibrate();
      beep();
      notifyRestDone();
      done.current();
    };
    const ms = rest.endsAt - Date.now();
    if (ms <= 0) {
      // Rust liep af terwijl de app op de achtergrond stond: stil afsluiten als het al lang geleden is.
      if (ms > -5000) fire();
      else done.current();
      return;
    }
    const t = setTimeout(fire, ms);
    return () => clearTimeout(t);
  }, [rest]);
}
