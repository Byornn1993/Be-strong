import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/States';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { SyncIndicator } from '@/components/layout/SyncIndicator';
import { useConflicts, useOutbox } from '@/lib/db/hooks';
import { getDb } from '@/lib/db/schema';
import { resolveConflict } from '@/lib/sync/engine';
import { flushSync } from '@/lib/sync/scheduler';
import { useSyncStatus } from '@/lib/sync/status';
import type { Conflict } from '@/lib/sync/types';
import { formatDate, formatTime } from '@/domain/dates';

const TABLE_LABELS: Record<Conflict['table'], string> = {
  exercises: 'Oefening',
  exercisePrefs: 'Oefeninginstelling',
  templates: 'Template',
  workouts: 'Workout',
  measurementTypes: 'Meettype',
  measurements: 'Meting',
  goals: 'Doel',
  widgets: 'Widget',
  profile: 'Profiel',
};

function describe(x: unknown): string {
  if (!x || typeof x !== 'object') return '—';
  const o = x as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof o.name === 'string') parts.push(o.name);
  if (typeof o.value === 'number') parts.push(`${o.value} ${o.unit ?? ''}`);
  if (typeof o.startedAt === 'string') parts.push(formatDate(o.startedAt));
  if (Array.isArray(o.exercises)) parts.push(`${o.exercises.length} oefeningen`);
  if (o.deletedAt) parts.push('verwijderd');
  return parts.join(' · ') || JSON.stringify(o).slice(0, 80);
}

export default function SyncPage() {
  const outbox = useOutbox();
  const conflicts = useConflicts();
  const status = useSyncStatus();
  const { confirm, dialog } = useConfirm();
  const [syncing, setSyncing] = useState(false);

  if (!outbox || !conflicts) return <Spinner />;

  return (
    <div>
      <PageHeader title="Synchronisatie" back="/settings" />
      <div className="space-y-4 px-4 md:px-0">
        <Card className="flex items-center justify-between gap-3 p-4">
          <div>
            <SyncIndicator />
            {status.lastSyncedAt && <p className="px-2 text-xs text-faint">Laatst: {formatDate(status.lastSyncedAt)} {formatTime(status.lastSyncedAt)}</p>}
            {status.error && <p className="px-2 text-xs text-danger">{status.error}</p>}
          </div>
          <Button
            icon={<RefreshCw size={16} />}
            loading={syncing}
            onClick={async () => {
              setSyncing(true);
              await flushSync().catch(() => {});
              setSyncing(false);
            }}
          >
            Nu synchroniseren
          </Button>
        </Card>

        {conflicts.length > 0 && (
          <section className="space-y-2">
            <p className="label">Conflicten</p>
            <p className="text-sm text-muted">Dit item werd op een ander toestel gewijzigd terwijl je het hier ook aanpaste. Kies welke versie blijft.</p>
            {conflicts.map((c) => (
              <Card key={c.key} className="space-y-3 p-4">
                <p className="font-semibold">{TABLE_LABELS[c.table]}</p>
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <div className="rounded-lg bg-surface-2 p-3">
                    <p className="label">Deze versie (dit toestel)</p>
                    <p className="mt-1">{describe(c.local)}</p>
                  </div>
                  <div className="rounded-lg bg-surface-2 p-3">
                    <p className="label">Serverversie ({formatDate(c.remoteUpdatedAt)} {formatTime(c.remoteUpdatedAt)})</p>
                    <p className="mt-1">{describe(c.remote)}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button block onClick={() => resolveConflict(getDb(), c.key, 'server').then(() => flushSync())}>
                    Serverversie
                  </Button>
                  <Button variant="primary" block onClick={() => resolveConflict(getDb(), c.key, 'mine').then(() => flushSync())}>
                    Mijn versie
                  </Button>
                </div>
              </Card>
            ))}
          </section>
        )}

        <section className="space-y-2">
          <p className="label">Wachtrij ({outbox.length})</p>
          {outbox.length === 0 ? (
            <p className="text-sm text-muted">Alles is verstuurd.</p>
          ) : (
            <Card className="divide-y divide-border">
              {outbox.map((op) => (
                <div key={op.seq} className="flex items-center gap-3 p-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{op.kind === 'rpc' ? op.fn : `${op.table}`}</p>
                    <p className="text-xs text-faint">
                      {formatDate(op.createdAt)} {formatTime(op.createdAt)}
                      {op.attempts > 0 && ` · ${op.attempts} poging(en)`}
                    </p>
                    {op.lastError && <p className="text-xs text-danger">{op.lastError}</p>}
                  </div>
                  {op.lastError && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={async () => {
                        if (await confirm({ title: 'Wijziging laten vallen?', message: 'Deze wijziging wordt niet naar de server gestuurd. Bij de volgende synchronisatie wordt alles opnieuw van de server opgehaald.', confirmLabel: 'Laten vallen', danger: true })) {
                          const db = getDb();
                          await db.outbox.delete(op.seq!);
                          // Volledige pull, zodat de lokale kopie weer gelijk loopt met de server.
                          await db.meta.where('key').startsWith('cursor:').delete();
                          void flushSync().catch(() => {});
                        }
                      }}
                    >
                      Laten vallen
                    </Button>
                  )}
                </div>
              ))}
            </Card>
          )}
        </section>
      </div>
      {dialog}
    </div>
  );
}
