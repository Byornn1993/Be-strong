// Signalen bij het einde van de rust. Alles met feature detection: de app werkt ook zonder.

let ctx: AudioContext | null = null;

/** Moet vanuit een gebruikersactie aangeroepen worden (bv. set afvinken), anders blokkeert iOS audio. */
export function primeAudio(): void {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

export function beep(): void {
  if (!ctx) return;
  try {
    const t = ctx.currentTime;
    for (const [i, f] of [880, 1175].entries()) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.25, t + i * 0.18 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.18 + 0.16);
      o.connect(g).connect(ctx.destination);
      o.start(t + i * 0.18);
      o.stop(t + i * 0.18 + 0.17);
    }
  } catch {
    /* geen geluid mogelijk */
  }
}

export function vibrate(pattern: number | number[] = [120, 60, 120]): void {
  if ('vibrate' in navigator) navigator.vibrate(pattern);
}

export function notifyRestDone(): void {
  if (!('Notification' in window) || Notification.permission !== 'granted' || document.visibilityState === 'visible') return;
  try {
    new Notification('Rust voorbij', { body: 'Tijd voor je volgende set.', tag: 'bestrong-rest', silent: false });
  } catch {
    /* sommige browsers staan dit enkel via de service worker toe */
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.requestPermission();
}

/** Scherm aan houden tijdens een workout (waar ondersteund). */
export async function requestWakeLock(): Promise<(() => void) | null> {
  const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
  if (!nav.wakeLock) return null;
  try {
    const lock = await nav.wakeLock.request('screen');
    return () => void lock.release().catch(() => {});
  } catch {
    return null;
  }
}
