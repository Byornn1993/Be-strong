import { createContext, useContext, useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
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
  /**
   * Vaste hoogte (bijna schermhoog) i.p.v. meegroeien met de inhoud. Voor vensters met een zoekveld:
   * anders krimpt het venster tijdens het typen (minder resultaten) en zakt de zoekbalk achter het toetsenbord.
   */
  tall?: boolean;
  labelledBy?: string;
}

/*
 * Pagina niet laten scrollen achter een open sheet. Met een teller i.p.v. "vorige waarde onthouden":
 * bij Finish/Verwijderen sluiten de workout-sheet en de Finish-sheet tegelijk, en dan zette de
 * binnenste sheet "overflow: hidden" terug nadat de buitenste het al had vrijgegeven. Gevolg: nergens
 * in de app kon je nog scrollen.
 */
const openDepths: number[] = [];
const listeners = new Set<() => void>();
function lockScroll(depth: number) {
  openDepths.push(depth);
  document.body.style.overflow = 'hidden';
  listeners.forEach((l) => l());
}
function unlockScroll(depth: number) {
  const i = openDepths.lastIndexOf(depth);
  if (i >= 0) openDepths.splice(i, 1);
  if (openDepths.length === 0) document.body.style.overflow = '';
  listeners.forEach((l) => l());
}

/** Aantal open sheets (bv. om de update-melding niet over een venster te leggen). */
export function useOpenSheetCount(): number {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => openDepths.length,
  );
}

/*
 * Zichtbaar deel van het scherm. Op iPhone schuift het toetsenbord OVER de pagina (de pagina wordt niet
 * kleiner), dus een venster onderaan zou erachter verdwijnen. We leggen het venster daarom op het
 * zichtbare stuk boven het toetsenbord (visualViewport).
 */
function useVisibleArea(active: boolean): { top: number; height: number } | null {
  const [area, setArea] = useState<{ top: number; height: number } | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!active || !vv) return;
    const update = () => {
      // Alleen bijsturen als er echt iets (toetsenbord) over het scherm ligt; anders gewoon de CSS-layout.
      const covered = window.innerHeight - vv.height > 80;
      setArea(covered ? { top: vv.offsetTop, height: vv.height } : null);
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      setArea(null);
    };
  }, [active]);
  return area;
}

/*
 * Een sheet die BINNEN een andere sheet opent (bv. Finish in het workoutscherm) ligt altijd erboven.
 * Vroeger hing dat af van de volgorde in de pagina: openden beide tegelijk, dan lag Finish eronder
 * (onzichtbaar) en leek de Finish-knop niet te werken.
 */
const DepthContext = createContext(0);

/** Bottom sheet op mobiel, gecentreerde modal op grotere schermen. Esc en tik op de achtergrond sluiten. */
export function Sheet({ open, onClose, title, action, children, footer, full, tall }: SheetProps) {
  const depth = useContext(DepthContext) + 1;
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
    // Escape sluit enkel het bovenste venster.
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && depth === Math.max(...openDepths) && closeRef.current();
    window.addEventListener('keydown', onKey);
    lockScroll(depth);
    panel.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      unlockScroll(depth);
      prev?.focus?.();
    };
  }, [open, depth]);

  const visible = useVisibleArea(open && !full);

  if (!open) return null;

  return createPortal(
    <div
      className={`fixed inset-0 flex ${full ? '' : 'items-end md:items-center'} justify-center`}
      style={{ zIndex: 50 + depth, ...(visible && { top: visible.top, height: visible.height, bottom: 'auto' }) }}
      role="presentation"
    >
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
            : `anim-sheet relative flex max-h-[92%] w-full flex-col rounded-t-[22px] border border-line-2 bg-surface shadow-pop outline-none md:max-w-lg md:rounded-[22px] ${tall ? 'h-[92%] md:h-[80%]' : ''}`
        }
        // Met open toetsenbord geen extra ruimte voor de iPhone-thuisbalk (die zit dan onder het toetsenbord).
        style={full ? { paddingTop: 'var(--safe-top)' } : { paddingBottom: visible ? 0 : 'var(--safe-bottom)' }}
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
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <DepthContext.Provider value={depth}>{children}</DepthContext.Provider>
        </div>
        {footer && <div className="border-t border-border p-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
