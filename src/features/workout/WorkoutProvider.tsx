import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { ActiveWorkout } from '@/lib/db/types';
import { discardActive, loadActive, saveActive } from './activeStore';

interface WorkoutCtx {
  active: ActiveWorkout | null;
  loaded: boolean;
  sheetOpen: boolean;
  openSheet: () => void;
  closeSheet: () => void;
  start: (w: ActiveWorkout) => Promise<void>;
  /** Wijziging toepassen; wordt METEEN lokaal bewaard. */
  update: (fn: (w: ActiveWorkout) => ActiveWorkout) => void;
  discard: () => Promise<void>;
  /** Na Finish: de workout is weg uit de actieve opslag. */
  clearAfterFinish: () => void;
  /** Wacht tot alle lokale schrijfacties klaar zijn (vóór Finish). */
  flush: () => Promise<void>;
}

const Ctx = createContext<WorkoutCtx | null>(null);

export function WorkoutProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ActiveWorkout | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const latest = useRef<ActiveWorkout | null>(null);
  const writeChain = useRef<Promise<void>>(Promise.resolve());

  // Herstel na refresh/crash/afsluiten.
  useEffect(() => {
    loadActive().then((a) => {
      latest.current = a;
      setActive(a);
      setLoaded(true);
    });
  }, []);

  const persist = (a: ActiveWorkout) => {
    // Schrijfacties strikt na elkaar, zodat een oudere versie nooit een nieuwere overschrijft.
    writeChain.current = writeChain.current.then(() => saveActive(a)).catch((e) => console.error('Opslaan workout mislukt', e));
  };

  const update = useCallback((fn: (w: ActiveWorkout) => ActiveWorkout) => {
    const cur = latest.current;
    if (!cur) return;
    const next = fn(cur);
    latest.current = next;
    setActive(next);
    persist(next);
  }, []);

  const start = useCallback(async (w: ActiveWorkout) => {
    latest.current = w;
    setActive(w);
    persist(w);
    await writeChain.current;
    setSheetOpen(true);
  }, []);

  const discard = useCallback(async () => {
    await writeChain.current;
    await discardActive();
    latest.current = null;
    setActive(null);
    setSheetOpen(false);
  }, []);

  const clearAfterFinish = useCallback(() => {
    latest.current = null;
    setActive(null);
    setSheetOpen(false);
  }, []);

  return (
    <Ctx.Provider
      value={{
        active,
        loaded,
        sheetOpen: sheetOpen && !!active,
        openSheet: () => setSheetOpen(true),
        closeSheet: () => setSheetOpen(false),
        start,
        update,
        discard,
        clearAfterFinish,
        flush: () => writeChain.current,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useActiveWorkout(): WorkoutCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('WorkoutProvider ontbreekt');
  return c;
}
