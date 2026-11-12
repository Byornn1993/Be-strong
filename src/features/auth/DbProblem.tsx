import { useEffect, useState } from 'react';
import Dexie from 'dexie';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/States';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { closeDb } from '@/lib/db/schema';

const SLOW_MS = 10_000;

/**
 * Scherm terwijl de lokale database opent. Lukt dat niet (of duurt het ongewoon lang), dan geen eindeloze
 * spinner maar uitleg en twee uitwegen: opnieuw proberen, of de lokale kopie wissen en opnieuw ophalen.
 */
export function OpeningDb({ userId, error }: { userId: string; error: string | null }) {
  const [slow, setSlow] = useState(false);
  const { confirm, dialog } = useConfirm();

  useEffect(() => {
    const t = setTimeout(() => setSlow(true), SLOW_MS);
    return () => clearTimeout(t);
  }, []);

  if (!error && !slow) return <Spinner label="Gegevens openen…" />;

  const rebuild = async () => {
    const ok = await confirm({
      title: 'Lokale kopie wissen?',
      message:
        'De gegevens op dit toestel worden gewist en opnieuw uit Supabase opgehaald. Wijzigingen die nog niet gesynchroniseerd waren, gaan verloren. Je blijft ingelogd.',
      confirmLabel: 'Wissen en ophalen',
      danger: true,
    });
    if (!ok) return;
    closeDb();
    await Dexie.delete(`bestrong-${userId}`).catch(() => {});
    window.location.reload();
  };

  return (
    <div className="mx-auto max-w-md space-y-4 p-6 pt-16">
      <div className="flex items-center gap-2 text-lg font-semibold text-danger">
        <AlertTriangle size={22} /> {error ? 'Gegevens openen mislukt' : 'Gegevens openen duurt lang'}
      </div>
      <p className="text-sm text-muted">
        De opslag op dit toestel reageert niet zoals verwacht. Meestal helpt opnieuw proberen. Lukt het daarna nog niet, wis dan de lokale kopie: je
        gegevens staan veilig in Supabase en worden opnieuw opgehaald.
      </p>
      {error && <p className="break-words rounded-lg bg-surface-2 p-2 text-xs text-faint">{error}</p>}
      <Button variant="primary" size="lg" block onClick={() => window.location.reload()}>
        Opnieuw proberen
      </Button>
      <Button variant="danger" block onClick={rebuild}>
        Lokale kopie wissen en opnieuw ophalen
      </Button>
      {dialog}
    </div>
  );
}
