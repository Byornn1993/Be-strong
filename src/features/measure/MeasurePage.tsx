import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Plus } from 'lucide-react';
import { Line, LineChart, ResponsiveContainer } from 'recharts';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { Spinner } from '@/components/ui/States';
import { useMeasurementTypes, useMeasurements } from '@/lib/db/hooks';
import { saveMeasurementType } from '@/lib/db/repo';
import { requireUserId } from '@/lib/db/session';
import { newId } from '@/lib/ids';
import type { MeasurementKind, MeasurementType } from '@/lib/db/types';
import { summarizeMeasurements } from '@/domain/measurements';
import { formatNumber } from '@/domain/format';
import { formatDate } from '@/domain/dates';
import { MeasurementForm } from './MeasurementForm';

export function Delta({ diff, pct, unit }: { diff: number | null; pct: number | null; unit: string }) {
  if (diff === null) return null;
  const sign = diff > 0 ? '+' : diff < 0 ? '−' : '±';
  return (
    <span className="text-xs text-muted">
      {sign}
      {formatNumber(Math.abs(diff))} {unit}
      {pct !== null && ` (${sign}${formatNumber(Math.abs(pct))}%)`}
    </span>
  );
}

export default function MeasurePage() {
  const types = useMeasurementTypes();
  const all = useMeasurements();
  const [adding, setAdding] = useState(false);
  const [newType, setNewType] = useState(false);

  if (!types || !all) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Metingen"
        actions={
          <Button size="sm" variant="primary" icon={<Plus size={16} />} onClick={() => setAdding(true)}>
            Meting
          </Button>
        }
      />
      <div className="grid gap-3 px-4 sm:grid-cols-2 desk:px-0 xl:grid-cols-3">
        {types.map((t) => {
          const s = summarizeMeasurements(t, all);
          const series = all.filter((m) => m.typeId === t.id).slice(-12);
          return (
            <Link key={t.id} to={`/measure/${t.id}`} className="card block p-4 transition hover:border-accent/40">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{t.name}</p>
                <ChevronRight size={18} className="text-faint" />
              </div>
              {s.current ? (
                <div className="mt-1 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-2xl font-semibold tracking-tight">
                      {formatNumber(s.current.value)}
                      <span className="ml-1 text-sm font-normal text-muted">{t.unit}</span>
                    </p>
                    <p className="text-xs text-faint">{formatDate(s.current.measuredAt)}</p>
                    <Delta diff={s.diff} pct={s.diffPct} unit={t.unit} />
                  </div>
                  {series.length > 1 && (
                    <div className="h-12 w-28" aria-hidden>
                      <ResponsiveContainer>
                        <LineChart data={series}>
                          <Line dataKey="value" stroke="var(--accent)" strokeWidth={2} dot={false} isAnimationActive={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-sm text-faint">Nog geen meting</p>
              )}
            </Link>
          );
        })}
        <button type="button" onClick={() => setNewType(true)} className="card flex min-h-[96px] items-center justify-center gap-2 border-dashed text-sm text-muted hover:text-text">
          <Plus size={16} /> Eigen meting toevoegen
        </button>
      </div>
      <MeasurementForm open={adding} onClose={() => setAdding(false)} types={types} />
      <NewTypeSheet open={newType} onClose={() => setNewType(false)} count={types.length} />
    </div>
  );
}

function NewTypeSheet({ open, onClose, count }: { open: boolean; onClose: () => void; count: number }) {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('cm');
  const [kind, setKind] = useState<MeasurementKind>('length');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !unit.trim()) return;
    const t: MeasurementType = {
      id: newId(),
      userId: requireUserId(),
      key: `custom_${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40)}`,
      name: name.trim().slice(0, 60),
      unit: unit.trim().slice(0, 12),
      kind,
      sortOrder: 100 + count,
      serverUpdatedAt: null,
      deletedAt: null,
    };
    await saveMeasurementType(t);
    setName('');
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="Eigen meting">
      <form onSubmit={submit} className="space-y-4 p-4">
        <label className="block">
          <span className="label">Naam</span>
          <input className="field mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="bv. Kuit" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label">Eenheid</span>
            <input className="field mt-1" value={unit} onChange={(e) => setUnit(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">Soort</span>
            <select className="field mt-1" value={kind} onChange={(e) => setKind(e.target.value as MeasurementKind)}>
              <option value="length">Omtrek/lengte</option>
              <option value="mass">Gewicht</option>
              <option value="percent">Percentage</option>
              <option value="other">Andere</option>
            </select>
          </label>
        </div>
        <Button type="submit" variant="primary" size="lg" block>
          Toevoegen
        </Button>
      </form>
    </Sheet>
  );
}
