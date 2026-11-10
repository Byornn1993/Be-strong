import { useRef, type ReactNode, type PointerEvent as RPointerEvent, type MouseEvent as RMouseEvent } from 'react';
import { Trash2 } from 'lucide-react';

/**
 * Veeg een rij naar links om ze te verwijderen (zoals in de Boodschappenlijst).
 * Verticaal scrollen blijft gewoon werken: pas na een duidelijke horizontale beweging neemt de veeg het over.
 * De rij beweegt via een directe transform (geen React-state per pixel), dus het blijft vloeiend.
 */
export function SwipeToDelete({ onDelete, children, label = 'Verwijderen' }: { onDelete: () => void; children: ReactNode; label?: string }) {
  const row = useRef<HTMLDivElement>(null);
  const bg = useRef<HTMLDivElement>(null);
  const g = useRef({ x: 0, y: 0, dx: 0, mode: 'idle' as 'idle' | 'pending' | 'swipe' | 'scroll', id: -1, suppressClick: false });

  const setX = (x: number, animate: boolean) => {
    const el = row.current;
    if (!el) return;
    el.style.transition = animate ? 'transform 180ms ease-out' : 'none';
    el.style.transform = x ? `translateX(${x}px)` : '';
    if (bg.current) bg.current.style.opacity = String(Math.min(1, Math.abs(x) / 60));
  };

  const onPointerDown = (e: RPointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    g.current = { x: e.clientX, y: e.clientY, dx: 0, mode: 'pending', id: e.pointerId, suppressClick: false };
  };

  const onPointerMove = (e: RPointerEvent) => {
    const s = g.current;
    if (s.id !== e.pointerId || s.mode === 'idle' || s.mode === 'scroll') return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (s.mode === 'pending') {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        s.mode = 'scroll';
        return;
      }
      if (dx < -12 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        s.mode = 'swipe';
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        // Toetsenbord dicht: anders verschuift de pagina tijdens het vegen.
        if (document.activeElement instanceof HTMLElement && row.current?.contains(document.activeElement)) document.activeElement.blur();
      } else return;
    }
    s.dx = Math.min(0, dx);
    setX(s.dx, false);
  };

  const finish = (e: RPointerEvent) => {
    const s = g.current;
    if (s.id !== e.pointerId) return;
    if (s.mode === 'swipe') {
      s.suppressClick = true;
      const width = row.current?.offsetWidth ?? 300;
      if (s.dx < -Math.min(110, width * 0.35)) {
        setX(-width, true);
        if ('vibrate' in navigator) navigator.vibrate(20);
        setTimeout(() => {
          onDelete();
          setX(0, false);
        }, 170);
      } else setX(0, true);
    }
    s.mode = 'idle';
  };

  const onClickCapture = (e: RMouseEvent) => {
    // Een veeg is geen tik: voorkom dat de knop onder je vinger (bv. ✓) reageert.
    if (g.current.suppressClick) {
      e.preventDefault();
      e.stopPropagation();
      g.current.suppressClick = false;
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div ref={bg} className="absolute inset-0 flex items-center justify-end gap-2 rounded-xl bg-danger/20 pr-4 text-sm font-semibold text-danger opacity-0" aria-hidden>
        <Trash2 size={18} /> {label}
      </div>
      <div
        ref={row}
        className="relative bg-transparent"
        style={{ touchAction: 'pan-y' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        onClickCapture={onClickCapture}
      >
        {children}
      </div>
    </div>
  );
}
