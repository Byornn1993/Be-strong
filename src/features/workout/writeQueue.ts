/**
 * Opslagwachtrij voor de lopende workout: schrijft altijd de nieuwste versie, nooit een oudere over een
 * nieuwere. Tijdens snel typen worden tussenversies overgeslagen (hooguit één schrijfactie wacht).
 */
export function createWriteQueue<T>(save: (value: T) => Promise<void>, onError: (e: unknown) => void = console.error) {
  let writing: Promise<void> | null = null;
  let pending: { value: T } | null = null;

  const drain = (): Promise<void> => {
    if (writing) return writing;
    // Niets te schrijven: NIET een "lege" schrijfactie als lopend registreren (anders blijft die voor
    // altijd hangen en wordt er nooit meer iets opgeslagen).
    if (!pending) return Promise.resolve();
    writing = (async () => {
      try {
        while (pending) {
          const next = pending.value;
          pending = null;
          try {
            await save(next);
          } catch (e) {
            onError(e);
          }
        }
      } finally {
        writing = null;
      }
    })();
    return writing;
  };

  return {
    push(value: T): void {
      pending = { value };
      void drain();
    },
    /** Openstaande versie laten vallen (bv. bij verwijderen van de workout). */
    clear(): void {
      pending = null;
    },
    /** Wacht tot alles geschreven is. */
    flush: drain,
  };
}
