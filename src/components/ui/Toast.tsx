import { useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';

// Korte bevestiging onderaan ("Bewaard ✓"). Van overal aan te roepen met toast('…'); <Toaster /> staat één keer in App.

let current: { id: number; text: string } | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(text = 'Bewaard'): void {
  current = { id: Date.now(), text };
  emit();
}

export function Toaster() {
  const t = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );

  useEffect(() => {
    if (!t) return;
    const timer = setTimeout(() => {
      if (current?.id === t.id) {
        current = null;
        emit();
      }
    }, 1800);
    return () => clearTimeout(timer);
  }, [t]);

  if (!t) return null;
  return createPortal(
    <div
      key={t.id}
      role="status"
      className="anim-toast pointer-events-none fixed left-1/2 z-[80] flex -translate-x-1/2 items-center gap-2 rounded-full border border-accent/40 bg-surface px-4 py-2 text-sm font-medium text-text shadow-pop"
      style={{ bottom: 'calc(var(--nav-h) + var(--safe-bottom) + 20px)' }}
    >
      <Check size={16} strokeWidth={3} className="text-accent" />
      {t.text}
    </div>,
    document.body,
  );
}
