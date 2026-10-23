import { useCallback, useState, type ReactNode } from 'react';
import { Sheet } from './Sheet';
import { Button } from './Button';

interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}

/** Bevestiging voor verwijderen en andere onomkeerbare acties. */
export function useConfirm() {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ ...opts, resolve })), []);

  const close = (ok: boolean) => {
    state?.resolve(ok);
    setState(null);
  };

  const dialog = (
    <Sheet open={!!state} onClose={() => close(false)} title={state?.title}>
      <div className="space-y-4 p-4">
        {state?.message && <div className="text-sm text-muted">{state.message}</div>}
        <div className="flex gap-2">
          <Button block onClick={() => close(false)}>
            Annuleren
          </Button>
          <Button block variant={state?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
            {state?.confirmLabel ?? 'Bevestigen'}
          </Button>
        </div>
      </div>
    </Sheet>
  );

  return { confirm, dialog };
}
