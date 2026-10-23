import { ChevronUp } from 'lucide-react';
import { useActiveWorkout } from '@/features/workout/WorkoutProvider';
import { useNow } from '@/lib/useNow';
import { workoutElapsedSec, restRemainingSec } from '@/domain/timer';
import { formatClock } from '@/domain/format';

/** Balk "Workout bezig · 0:42 · Hervatten" op elke pagina zolang er een workout loopt. */
export function ActiveWorkoutBar() {
  const { active, openSheet } = useActiveWorkout();
  const now = useNow(1000);
  if (!active) return null;
  const rest = restRemainingSec(active.rest, now);
  return (
    <button
      type="button"
      onClick={openSheet}
      className="fixed inset-x-2 z-30 flex min-h-[52px] items-center gap-3 rounded-2xl border border-accent/30 bg-primary px-4 text-left shadow-lg shadow-black/40 md:bottom-4 md:left-auto md:right-6 md:w-96"
      style={{ bottom: 'calc(var(--nav-h) + var(--safe-bottom) + 8px)' }}
    >
      <span className="relative flex h-2.5 w-2.5">
        {!active.pausedAt && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />}
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${active.pausedAt ? 'bg-warn' : 'bg-accent'}`} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{active.pausedAt ? 'Workout gepauzeerd' : 'Workout bezig'}</span>
        <span className="block text-xs tabular-nums text-accent/80">
          {formatClock(workoutElapsedSec(active, now))}
          {rest > 0 && ` · rust ${formatClock(rest)}`}
        </span>
      </span>
      <span className="flex items-center gap-1 text-sm font-semibold text-accent">
        Hervatten <ChevronUp size={18} />
      </span>
    </button>
  );
}
