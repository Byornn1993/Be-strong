import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface UndoInfo {
  id: number;
  text: string;
  undo: () => void;
}

/** Melding onderaan met "Ongedaan maken". Verdwijnt na 5 seconden. */
export function UndoToast({ info, onClose, bottom = 'calc(var(--safe-bottom) + 96px)' }: { info: UndoInfo | null; onClose: () => void; bottom?: string }) {
  useEffect(() => {
    if (!info) return;
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [info, onClose]);

  if (!info) return null;
  return createPortal(
    <div
      role="status"
      className="anim-toast fixed left-1/2 z-[70] flex w-[min(92vw,420px)] -translate-x-1/2 items-center gap-3 rounded-2xl border border-line bg-surface py-2 pl-4 pr-2 text-sm text-text shadow-pop"
      style={{ bottom }}
    >
      <span className="flex-1">{info.text}</span>
      <button
        type="button"
        className="tap rounded-sm2 px-3 font-semibold text-accent hover:bg-champ/[0.07]"
        onClick={() => {
          info.undo();
          onClose();
        }}
      >
        Ongedaan maken
      </button>
    </div>,
    document.body,
  );
}
