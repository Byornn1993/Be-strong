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
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className={`fixed inset-0 z-50 flex ${full ? '' : 'items-end md:items-center'} justify-center`} role="presentation">
      {!full && <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={onClose} aria-hidden />}
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className={
          full
            ? 'anim-sheet relative flex h-full w-full flex-col bg-bg outline-none'
            : 'anim-sheet relative flex max-h-[92dvh] w-full flex-col rounded-t-[22px] border border-border bg-surface outline-none md:max-w-lg md:rounded-[22px]'
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
