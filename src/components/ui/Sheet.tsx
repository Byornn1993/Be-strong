import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { IconButton } from './Button';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  /** Knop rechts in de kop (bv. "Bewerk"). */
  action?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Volledig scherm (actieve workout) i.p.v. een bottom sheet. */
  full?: boolean;
  labelledBy?: string;
}

/*
 * Pagina niet laten scrollen achter een open sheet. Met een teller i.p.v. "vorige waarde onthouden":
 * bij Finish/Verwijderen sluiten de workout-sheet en de Finish-sheet tegelijk, en dan zette de
 * binnenste sheet "overflow: hidden" terug nadat de buitenste het al had vrijgegeven. Gevolg: nergens
 * in de app kon je nog scrollen.
 */
let openSheets = 0;
function lockScroll() {
  openSheets += 1;
  document.body.style.overflow = 'hidden';
}
function unlockScroll() {
  openSheets = Math.max(0, openSheets - 1);
  if (openSheets === 0) document.body.style.overflow = '';
}

/** Bottom sheet op mobiel, gecentreerde modal op grotere schermen. Esc en tik op de achtergrond sluiten. */
export function Sheet({ open, onClose, title, action, children, footer, full }: SheetProps) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  // Alleen bij openen/sluiten: focus naar het paneel. Niet bij elke render (anders steelt het de focus).
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('keydown', onKey);
    lockScroll();
    panel.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      unlockScroll();
      prev?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className={`fixed inset-0 z-50 flex ${full ? '' : 'items-end md:items-center'} justify-center`} role="presentation">
      {!full && <div className="absolute inset-0 bg-[var(--overlay)]" onClick={onClose} aria-hidden />}
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className={
          full
            ? 'anim-sheet relative page-bg flex h-full w-full flex-col outline-none'
            : 'anim-sheet relative flex max-h-[92dvh] w-full flex-col rounded-t-[22px] border border-line-2 bg-surface shadow-pop outline-none md:max-w-lg md:rounded-[22px]'
        }
        style={full ? { paddingTop: 'var(--safe-top)' } : { paddingBottom: 'var(--safe-bottom)' }}
      >
        {(title || action) && (
          <div className="flex items-center gap-2 border-b border-border px-2 py-1.5">
            <IconButton label="Sluiten" onClick={onClose}>
              <X size={20} />
            </IconButton>
            <h2 id={titleId} className="min-w-0 flex-1 truncate text-center text-base font-semibold">
              {title}
            </h2>
            <div className="flex min-w-[44px] justify-end">{action}</div>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
        {footer && <div className="border-t border-border p-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
