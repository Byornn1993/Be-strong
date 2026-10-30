import { useEffect, useState } from 'react';
import { Download, Smartphone, Monitor } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { clearInstallPrompt, getInstallPrompt, onInstallPrompt } from '@/lib/installPrompt';

// "App installeren / icoon vernieuwen". Een website kan een beginschermicoon niet zelf vervangen;
// deze kaart geeft per toestel de juiste stappen, en op pc (Chrome/Edge) een echte installeerknop.


const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export const APP_LINK = 'https://byornn1993.github.io/Be-strong/';

export function InstallCard() {
  const [canInstall, setCanInstall] = useState(!!getInstallPrompt());
  const [done, setDone] = useState(false);
  const ios = isIos();
  const installed = isStandalone();

  useEffect(() => onInstallPrompt(() => setCanInstall(true)), []);

  const install = async () => {
    const p = getInstallPrompt();
    if (!p) return;
    await p.prompt();
    const r = await p.userChoice;
    clearInstallPrompt();
    setCanInstall(false);
    setDone(r.outcome === 'accepted');
  };

  return (
    <Card className="space-y-3 p-4">
      <p className="flex items-center gap-2 font-semibold">
        <Download size={18} className="text-accent" /> App installeren of icoon vernieuwen
      </p>
      <p className="text-sm text-muted">
        Een telefoon of pc vervangt een geïnstalleerd icoon niet vanzelf. Wil je het nieuwe icoon, verwijder dan het oude en installeer opnieuw. Je gegevens blijven veilig in Supabase.
      </p>

      {canInstall && (
        <Button variant="primary" block icon={<Download size={16} />} onClick={install}>
          Installeer Be Strong
        </Button>
      )}
      {done && <p className="text-sm text-accent">Geïnstalleerd. Je vindt Be Strong nu bij je apps.</p>}

      <div className="space-y-1 rounded-sm2 border border-line-2 p-3 text-sm">
        <p className="flex items-center gap-2 font-medium">
          <Smartphone size={16} className="text-accent" /> iPhone {ios && <span className="text-xs text-muted">(dit toestel)</span>}
        </p>
        <ol className="list-decimal space-y-0.5 pl-5 text-muted">
          <li>Houd het oude Be Strong-icoon ingedrukt › <em>Verwijder app</em>.</li>
          <li>
            Open <span className="text-text">{APP_LINK.replace('https://', '')}</span> in <strong className="text-text">Safari</strong>.
          </li>
          <li>
            Tik op <em>Deel</em> (vierkantje met pijl) › <em>Zet op beginscherm</em> › <em>Voeg toe</em>.
          </li>
          <li>Open Be Strong via het nieuwe icoon en log één keer in.</li>
        </ol>
      </div>

      <div className="space-y-1 rounded-sm2 border border-line-2 p-3 text-sm">
        <p className="flex items-center gap-2 font-medium">
          <Monitor size={16} className="text-accent" /> Pc (Chrome of Edge) {!ios && <span className="text-xs text-muted">(dit toestel)</span>}
        </p>
        <ol className="list-decimal space-y-0.5 pl-5 text-muted">
          <li>
            Al geïnstalleerd? Open de Be Strong-app › menu <em>⋮</em> rechtsboven › <em>Be Strong verwijderen</em>.
          </li>
          <li>Open de link hieronder in Chrome of Edge.</li>
          <li>
            Klik op het installeer-icoon rechts in de adresbalk (scherm met pijl) › <em>Installeren</em>, of gebruik de knop hierboven.
          </li>
        </ol>
      </div>

      <a href={APP_LINK} target="_blank" rel="noreferrer" className="block break-all rounded-sm2 bg-primary px-3 py-2 text-center text-sm font-medium text-accent">
        {APP_LINK}
      </a>
      {installed && <p className="text-xs text-muted">Je gebruikt Be Strong nu als geïnstalleerde app.</p>}
    </Card>
  );
}
