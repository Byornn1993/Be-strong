import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ActiveWorkout } from '@/lib/db/types';
import { discardActive, loadActive, saveActive } from './activeStore';

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

  // Opslaan: altijd de nieuwste versie, nooit een oudere over een nieuwere. Tijdens snel typen
  // worden tussenversies overgeslagen: er staat hooguit één schrijfactie in de wachtrij.
  const writing = useRef<Promise<void> | null>(null);
  const pending = useRef<ActiveWorkout | null>(null);

  const drain = useCallback((): Promise<void> => {
    if (writing.current) return writing.current;
    const run = async () => {
      while (pending.current) {
        const next = pending.current;
        pending.current = null;
        try {
          await saveActive(next);
        } catch (e) {
          console.error('Opslaan workout mislukt', e);
        }
      }
      writing.current = null;
    };
    writing.current = run();
    return writing.current;
  }, []);

  const persist = useCallback(
    (a: ActiveWorkout) => {
      pending.current = a;
      void drain();
    },
    [drain],
  );

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
        persist(next);
      },
      start: async (w) => {
        latest.current = w;
        setActive(w);
        persist(w);
        await drain();
        setSheetOpen(true);
      },
      discard: async () => {
        pending.current = null;
        await drain();
        await discardActive();
        latest.current = null;
        setActive(null);
        setSheetOpen(false);
      },
      clearAfterFinish: () => {
        latest.current = null;
        setActive(null);
        setSheetOpen(false);
      },
      flush: () => drain(),
      getActive: () => latest.current,
    }),
    [drain, persist],
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
