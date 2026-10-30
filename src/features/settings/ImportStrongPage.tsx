import { useState } from 'react';
import { FileUp } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, Stat } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/States';
import { useExercises } from '@/lib/db/hooks';
import { importWorkouts } from '@/lib/db/repo';
import { requireUserId } from '@/lib/db/session';
import { flushSync } from '@/lib/sync/scheduler';
import type { Exercise } from '@/lib/db/types';
import { parseStrongCsv, StrongFormatError, type StrongImportResult } from '@/domain/import/strong';
import { formatDate } from '@/domain/dates';
import { formatDuration } from '@/domain/format';
import { TYPE_LABELS } from '@/domain/exerciseTypes';

export default function ImportStrongPage() {
  const library = useExercises();
  const [result, setResult] = useState<StrongImportResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  if (!library) return <Spinner />;

  const onFile = async (file: File | undefined) => {
    setResult(null);
    setDone(null);
    setError(null);
    if (!file) return;
    setFileName(file.name);
    try {
      const text = await file.text();
      setResult(parseStrongCsv(text, library, requireUserId()));
    } catch (e) {
      setError(e instanceof StrongFormatError ? e.message : `Kon het bestand niet lezen: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const run = async () => {
    if (!result) return;
    setBusy(true);
    try {
      const uid = requireUserId();
      const newExercises: Exercise[] = result.newExercises.map((d) => ({
        id: d.id,
        userId: uid,
        name: d.name,
        primaryMuscle: 'full_body',
        secondaryMuscles: [],
        equipment: d.equipment,
        type: d.type,
        instructions: null,
        imagePath: null,
        notes: 'Aangemaakt bij Strong-import. Pas spiergroep en materiaal aan waar nodig.',
        serverUpdatedAt: null,
        deletedAt: null,
      }));
      const r = await importWorkouts(newExercises, result.workouts);
      setDone(`${r.added} workout${r.added === 1 ? '' : 's'} geïmporteerd${r.skipped ? `, ${r.skipped} bestond${r.skipped === 1 ? '' : 'en'} al` : ''}. De gegevens worden nu gesynchroniseerd.`);
      setResult(null);
      void flushSync().catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const s = result?.stats;

  return (
    <div>
      <PageHeader title="Strong-import" back="/settings" />
      <div className="space-y-4 px-4 desk:px-0">
        <Card className="space-y-3 p-4 text-sm text-muted">
          <p>
            Exporteer in de Strong-app via <em>Settings › Export Strong Data</em> en kies hier het CSV-bestand. Je krijgt eerst een voorbeeld; er wordt pas iets opgeslagen als je bevestigt.
          </p>
          <p>Opnieuw importeren is veilig: workouts die al bestaan worden overgeslagen, er komen nooit dubbels.</p>
          <label className="flex min-h-[52px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-2 px-4 font-medium text-text hover:border-accent/50">
            <FileUp size={18} className="text-accent" />
            {fileName || 'Kies strong_workouts.csv'}
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
        </Card>

        {error && <p className="rounded-card border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</p>}
        {done && <p className="rounded-card border border-accent/30 bg-primary-soft p-3 text-sm text-accent">{done}</p>}

        {result && s && (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Stat hero label="Workouts" value={s.workouts} hint={s.firstDate && s.lastDate ? `${formatDate(s.firstDate)} – ${formatDate(s.lastDate)}` : undefined} />
              <Stat label="Sets" value={s.sets} />
              <Stat label="Onbekende oefeningen" value={result.newExercises.length} hint="worden eigen oefeningen" />
              <Stat label="Overgeslagen rijen" value={s.restTimerRows + s.skippedRows.length} hint={`${s.restTimerRows} rusttimer-rijen`} />
            </div>

            {result.newExercises.length > 0 && (
              <Card className="p-4">
                <p className="font-semibold">Nieuwe eigen oefeningen</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {result.newExercises.map((e) => (
                    <li key={e.id}>
                      {e.name} <span className="text-muted">· {TYPE_LABELS[e.type]}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            <Card className="p-4">
              <p className="font-semibold">Koppeling van oefeningnamen</p>
              <ul className="mt-2 max-h-64 space-y-0.5 overflow-y-auto text-sm">
                {result.mappings.map((m) => (
                  <li key={m.csvName} className="flex justify-between gap-3">
                    <span className="truncate">“{m.csvName}”</span>
                    <span className={m.isNew ? 'text-warn' : m.csvName.trim() === m.exerciseName ? 'text-muted' : 'text-accent'}>
                      {m.isNew ? 'nieuw' : m.csvName.trim() === m.exerciseName ? '✓' : `→ ${m.exerciseName}`}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>

            {(s.longWorkouts.length > 0 || s.weightOnBodyweight > 0 || s.skippedRows.length > 0) && (
              <Card className="space-y-2 p-4 text-sm">
                <p className="font-semibold">Ter info (waarden worden overgenomen zoals ze zijn)</p>
                {s.longWorkouts.length > 0 && (
                  <p className="text-muted">
                    {s.longWorkouts.length} workout(s) met een ongewoon lange duur (bv. {s.longWorkouts[0]!.name}, {formatDuration(s.longWorkouts[0]!.durationSec)}). Je kan de duur later aanpassen in de geschiedenis.
                  </p>
                )}
                {s.weightOnBodyweight > 0 && <p className="text-muted">{s.weightOnBodyweight} set(s) hebben een gewicht bij een oefening zonder gewichtskolom (bv. Crunch). Dat gewicht wordt bewaard.</p>}
                {s.skippedRows.slice(0, 10).map((r) => (
                  <p key={r.line} className="text-warn">
                    Regel {r.line}: {r.reason}
                  </p>
                ))}
              </Card>
            )}

            <Button variant="primary" size="lg" block loading={busy} onClick={run}>
              Importeer {s.workouts} workouts
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
