import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ActiveWorkout } from '@/lib/db/types';
import { discardActive, loadActive, saveActive } from './activeStore';
import { createWriteQueue } from './writeQueue';

// Drie contexten, zodat een toetsaanslag in een set niet de hele app opnieuw laat tekenen:
//  - Actions: stabiele functies (veranderen nooit)
//  - Status:  heeft er een workout loopt / sheet open (verandert zelden)
//  - Active:  de volledige lopende workout (verandert bij elke wijziging; enkel workoutscherm en balk)

interface WorkoutActions {
  openSheet: () => void;
  closeSheet: () => void;
  start: (w: ActiveWorkout) => Promise<void>;
  /** Wijziging toepassen; wordt meteen lokaal bewaard. */
  update: (fn: (w: ActiveWorkout) => ActiveWorkout) => void;
  discard: () => Promise<void>;
  /** Na Finish: de workout is weg uit de actieve opslag. */
  clearAfterFinish: () => void;
  /** Wacht tot alle lokale schrijfacties klaar zijn (vóór Finish). */
  flush: () => Promise<void>;
  /** Huidige workout op dit moment (zonder te herrenderen). */
  getActive: () => ActiveWorkout | null;
}

interface WorkoutStatus {
  hasActive: boolean;
  loaded: boolean;
  sheetOpen: boolean;
}

const ActionsCtx = createContext<WorkoutActions | null>(null);
const StatusCtx = createContext<WorkoutStatus>({ hasActive: false, loaded: false, sheetOpen: false });
const ActiveCtx = createContext<ActiveWorkout | null>(null);

export function WorkoutProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ActiveWorkout | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const latest = useRef<ActiveWorkout | null>(null);

  // Opslaan: altijd de nieuwste versie; tijdens snel typen worden tussenversies overgeslagen.
  const [queue] = useState(() => createWriteQueue<ActiveWorkout>(saveActive, (e) => console.error('Opslaan workout mislukt', e)));

  // Herstel na refresh/crash/afsluiten.
  useEffect(() => {
    loadActive().then((a) => {
      latest.current = a;
      setActive(a);
      setLoaded(true);
    });
  }, []);

  const actions = useMemo<WorkoutActions>(
    () => ({
      openSheet: () => setSheetOpen(true),
      closeSheet: () => setSheetOpen(false),
      update: (fn) => {
        const cur = latest.current;
        if (!cur) return;
        const next = fn(cur);
        if (next === cur) return;
        latest.current = next;
        setActive(next);
        queue.push(next);
      },
      start: async (w) => {
        latest.current = w;
        setActive(w);
        queue.push(w);
        await queue.flush();
        setSheetOpen(true);
      },
      discard: async () => {
        queue.clear();
        await queue.flush();
        await discardActive();
        latest.current = null;
        setActive(null);
        setSheetOpen(false);
      },
      clearAfterFinish: () => {
        queue.clear();
        latest.current = null;
        setActive(null);
        setSheetOpen(false);
      },
      flush: () => queue.flush(),
      getActive: () => latest.current,
    }),
    [queue],
  );

  const hasActive = !!active;
  const status = useMemo(() => ({ hasActive, loaded, sheetOpen: sheetOpen && hasActive }), [hasActive, loaded, sheetOpen]);

  return (
    <ActionsCtx.Provider value={actions}>
      <StatusCtx.Provider value={status}>
        <ActiveCtx.Provider value={active}>{children}</ActiveCtx.Provider>
      </StatusCtx.Provider>
    </ActionsCtx.Provider>
  );
}

export function useWorkoutActions(): WorkoutActions {
  const c = useContext(ActionsCtx);
  if (!c) throw new Error('WorkoutProvider ontbreekt');
  return c;
}

export const useWorkoutStatus = () => useContext(StatusCtx);

/** Volledige lopende workout: herrendert bij elke wijziging. Enkel gebruiken waar de inhoud nodig is. */
export function useActiveWorkout(): WorkoutActions & WorkoutStatus & { active: ActiveWorkout | null } {
  return { ...useWorkoutActions(), ...useWorkoutStatus(), active: useContext(ActiveCtx) };
}
