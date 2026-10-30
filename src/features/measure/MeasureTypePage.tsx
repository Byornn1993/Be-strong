import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { PageHeader, Tabs } from '@/components/ui/PageHeader';
import { Button, IconButton } from '@/components/ui/Button';
import { Card, Stat } from '@/components/ui/Card';
import { EmptyState, Spinner } from '@/components/ui/States';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { TrendChart } from '@/components/charts';
import { useMeasurementTypes, useMeasurements } from '@/lib/db/hooks';
import { deleteMeasurement } from '@/lib/db/repo';
import type { Measurement } from '@/lib/db/types';
import { inPeriod, summarizeMeasurements, type MeasurePeriod } from '@/domain/measurements';
import { formatDate, formatShortDate } from '@/domain/dates';
import { formatNumber } from '@/domain/format';
import { MeasurementForm } from './MeasurementForm';
import { Delta } from './MeasurePage';

export default function MeasureTypePage() {
  const { typeId } = useParams();
  const types = useMeasurementTypes();
  const all = useMeasurements();
  const { confirm, dialog } = useConfirm();
  const [period, setPeriod] = useState<MeasurePeriod>('6m');
  const [editing, setEditing] = useState<Measurement | null>(null);
  const [adding, setAdding] = useState(false);
  const now = useMemo(() => new Date(), []);

  const type = types?.find((t) => t.id === typeId);
  const list = useMemo(() => (all ?? []).filter((m) => m.typeId === typeId), [all, typeId]);
  const shown = useMemo(() => inPeriod(list, period, now), [list, period, now]);

  if (!types || !all) return <Spinner />;
  if (!type) return <EmptyState title="Meting niet gevonden" />;
  const s = summarizeMeasurements(type, all);

  return (
    <div>
      <PageHeader
        title={type.name}
        back="/measure"
        actions={
          <Button size="sm" variant="primary" icon={<Plus size={16} />} onClick={() => setAdding(true)}>
            Toevoegen
          </Button>
        }
      />
      <div className="space-y-4 px-4 desk:px-0">
        <div className="grid grid-cols-2 gap-2">
          <Stat hero label="Huidig" value={s.current ? `${formatNumber(s.current.value)} ${type.unit}` : '—'} hint={s.current ? formatDate(s.current.measuredAt) : undefined} />
          <Stat
            label="Vorige"
            value={s.previous ? `${formatNumber(s.previous.value)} ${type.unit}` : '—'}
            hint={<Delta diff={s.diff} pct={s.diffPct} unit={type.unit} />}
          />
        </div>
        <Tabs
          value={period}
          onChange={setPeriod}
          tabs={[
            { value: '1m', label: '1M' },
            { value: '3m', label: '3M' },
            { value: '6m', label: '6M' },
            { value: '1y', label: '1J' },
            { value: 'all', label: 'Alles' },
          ]}
        />
        <Card className="p-2">
          {shown.length < 2 ? (
            <p className="p-6 text-center text-sm text-muted">Minstens twee metingen in deze periode nodig voor een grafiek.</p>
          ) : (
            <TrendChart unit={type.unit} data={shown.map((m) => ({ label: formatShortDate(m.measuredAt), value: m.value }))} height={240} />
          )}
        </Card>
        <Card className="divide-y divide-border">
          {list.length === 0 && <EmptyState title="Nog geen metingen" action={<Button variant="primary" onClick={() => setAdding(true)}>Eerste meting toevoegen</Button>} />}
          {[...list].reverse().map((m) => (
            <div key={m.id} className="flex items-center gap-2 px-4 py-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium tabular-nums">
                  {formatNumber(m.value)} {m.unit}
                </p>
                <p className="truncate text-xs text-muted">
                  {formatDate(m.measuredAt)} · {m.source === 'device' ? 'apparaat' : 'manueel'}
                  {m.note && ` · ${m.note}`}
                </p>
              </div>
              <IconButton label="Bewerken" onClick={() => setEditing(m)}>
                <Pencil size={18} />
              </IconButton>
              <IconButton
                label="Verwijderen"
                onClick={async () => {
                  if (await confirm({ title: 'Meting verwijderen?', message: `${formatNumber(m.value)} ${m.unit} op ${formatDate(m.measuredAt)}`, confirmLabel: 'Verwijderen', danger: true }))
                    await deleteMeasurement(m.id);
                }}
              >
                <Trash2 size={18} />
              </IconButton>
            </div>
          ))}
        </Card>
      </div>
      <MeasurementForm open={adding || !!editing} onClose={() => (setAdding(false), setEditing(null))} types={types} initialTypeId={type.id} measurement={editing ?? undefined} />
      {dialog}
    </div>
  );
}
