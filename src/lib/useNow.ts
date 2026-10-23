import { useEffect, useState } from 'react';

/**
 * Huidige tijd, opnieuw gerenderd elke `ms`. Alleen voor WEERGAVE: timers rekenen altijd met
 * timestamps, zodat een gemiste tick (achtergrond, vergrendeld scherm) niets uitmaakt.
 */
export function useNow(ms = 1000, enabled = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, ms);
    const onVis = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [ms, enabled]);
  return now;
}
