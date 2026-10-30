import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sun } from 'lucide-react';
import { nextTheme, setTheme, THEME_LABEL, useTheme } from '@/lib/theme';

/** Themaknop: automatisch → licht → donker. Toont de huidige stand en een korte melding bij elke wissel. */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const theme = useTheme();
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1600);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          const next = nextTheme(theme);
          setTheme(next);
          setToast(`${THEME_LABEL[next]} ingesteld`);
        }}
        className={`flex min-h-[44px] w-full items-center gap-3 rounded-sm2 px-3 text-sm text-muted transition-colors duration-150 hover:bg-champ/[0.07] hover:text-text ${className}`}
        aria-label={`${THEME_LABEL[theme]}. Tik om te wisselen.`}
      >
        <Sun size={18} strokeWidth={2} className="shrink-0 text-accent" />
        <span>{THEME_LABEL[theme]}</span>
      </button>
      {toast &&
        createPortal(
          <div
            role="status"
            className="anim-toast fixed left-1/2 z-[70] -translate-x-1/2 rounded-full border border-line bg-surface px-4 py-2 text-sm text-text shadow-pop"
            style={{ bottom: 'calc(var(--nav-h) + var(--safe-bottom) + 16px)' }}
          >
            {toast}
          </div>,
          document.body,
        )}
    </>
  );
}
