import { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/Button';

/**
 * Nieuwe versie van de app beschikbaar → vraag om te herladen. Nooit automatisch tijdens een workout:
 * de gebruiker kiest zelf (de lopende workout blijft bewaard in IndexedDB).
 */
export function UpdatePrompt() {
  const [busy, setBusy] = useState(false);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      // Bij het openen van de app (en elk uur) kijken of er een nieuwe versie is. Zo staat die al
      // klaar voor je op "Herladen" tikt, en moet er dan niets meer gedownload worden.
      setInterval(() => void reg.update(), 60 * 60 * 1000);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void reg.update();
      });
    },
  });

  const reload = () => {
    if (busy) return;
    setBusy(true);
    // Normaal herlaadt de app zodra de nieuwe versie actief is. Op iOS komt dat signaal soms traag
    // of niet: dan herladen we na 2,5 s zelf (de nieuwe versie staat dan klaar).
    void updateServiceWorker(true);
    setTimeout(() => window.location.reload(), 2500);
  };

  if (!needRefresh && !offlineReady) return null;
  return (
    <div className="fixed inset-x-3 top-3 z-[60] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-xl" style={{ marginTop: 'var(--safe-top)' }} role="status">
      <p className="flex-1 text-sm">{needRefresh ? (busy ? 'Nieuwe versie laden…' : 'Er is een nieuwe versie van Be Strong.') : 'Be Strong werkt nu ook offline.'}</p>
      {needRefresh ? (
        <Button size="sm" variant="primary" loading={busy} onClick={reload}>
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
