import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/Button';

/**
 * Nieuwe versie van de app beschikbaar → vraag om te herladen. Nooit automatisch tijdens een workout:
 * de gebruiker kiest zelf (de lopende workout blijft bewaard in IndexedDB).
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      if (reg) setInterval(() => void reg.update(), 60 * 60 * 1000);
    },
  });

  if (!needRefresh && !offlineReady) return null;
  return (
    <div className="fixed inset-x-3 top-3 z-[60] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-xl" style={{ marginTop: 'var(--safe-top)' }} role="status">
      <p className="flex-1 text-sm">{needRefresh ? 'Er is een nieuwe versie van Be Strong.' : 'Be Strong werkt nu ook offline.'}</p>
      {needRefresh ? (
        <Button size="sm" variant="primary" onClick={() => updateServiceWorker(true)}>
          Herladen
        </Button>
      ) : (
        <Button size="sm" onClick={() => (setOfflineReady(false), setNeedRefresh(false))}>
          OK
        </Button>
      )}
    </div>
  );
}
