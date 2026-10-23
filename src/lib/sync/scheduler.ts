import type { BeStrongDb } from '@/lib/db/schema';
import { RemoteError, syncOnce, type RemoteApi } from './engine';
import { setSyncStatus } from './status';

// Bepaalt WANNEER er gesynchroniseerd wordt: bij het opstarten, bij online komen, bij terugkeren naar
// de app, kort na elke lokale wijziging en elke minuut zolang de app zichtbaar is.
// Er draait nooit meer dan één ronde tegelijk. Niets hangt af van Background Sync (werkt niet op iOS).

let db: BeStrongDb | null = null;
let api: RemoteApi | null = null;
let running: Promise<void> | null = null;
let again = false;
let debounce: ReturnType<typeof setTimeout> | null = null;
let interval: ReturnType<typeof setInterval> | null = null;

async function run(): Promise<void> {
  if (!db || !api) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    setSyncStatus({ phase: 'offline', online: false });
    return;
  }
  setSyncStatus({ phase: 'syncing', online: true, error: null });
  try {
    const r = await syncOnce(db, api);
    setSyncStatus({
      phase: r.blockedBy ? 'error' : 'idle',
      lastSyncedAt: new Date().toISOString(),
      error: r.blockedBy ? 'Er is een conflict dat je moet oplossen.' : null,
    });
  } catch (e) {
    const network = e instanceof RemoteError && e.network;
    const msg = e instanceof Error ? e.message : String(e);
    const storage = /UnknownError|Unable to open cursor|Indexed ?Database|IDB/i.test(`${(e as { name?: string })?.name ?? ''} ${msg}`);
    setSyncStatus({
      phase: network ? 'offline' : 'error',
      online: !network,
      error: network
        ? null
        : storage
          ? `De opslag op dit toestel gaf een fout (${msg}). Probeer opnieuw, of kies hieronder “Lokale kopie opnieuw opbouwen”.`
          : msg,
    });
  }
}

export function requestSync(delayMs = 0): void {
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(() => {
    debounce = null;
    if (running) {
      again = true;
      return;
    }
    running = run().finally(() => {
      running = null;
      if (again) {
        again = false;
        requestSync(500);
      }
    });
  }, delayMs);
}

const onOnline = () => {
  setSyncStatus({ online: true });
  requestSync();
};
const onOffline = () => setSyncStatus({ online: false, phase: 'offline' });
const onVisible = () => {
  if (document.visibilityState === 'visible') requestSync();
};

export function startSync(database: BeStrongDb, remote: RemoteApi): () => void {
  db = database;
  api = remote;
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  document.addEventListener('visibilitychange', onVisible);
  interval = setInterval(() => {
    if (document.visibilityState === 'visible') requestSync();
  }, 60_000);
  requestSync();
  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    document.removeEventListener('visibilitychange', onVisible);
    if (interval) clearInterval(interval);
    if (debounce) clearTimeout(debounce);
    db = null;
    api = null;
  };
}

/** Wordt na elke lokale wijziging aangeroepen. */
export function notifyLocalChange(): void {
  if (db) requestSync(1500);
}

/** Wacht tot een lopende ronde klaar is (bv. vóór uitloggen). */
export async function flushSync(): Promise<void> {
  if (running) await running;
  await run();
}
