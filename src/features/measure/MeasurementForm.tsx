import { useEffect, useState, type FormEvent } from 'react';
import { z } from 'zod';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { NumberInput } from '@/components/ui/NumberInput';
import type { Measurement, MeasurementType } from '@/lib/db/types';
import { saveMeasurement } from '@/lib/db/repo';
import { newId } from '@/lib/ids';
import { dayKey, isoToTimeInput, localInputToIso } from '@/domain/dates';

const schema = z.object({ value: z.number().min(0).max(100000), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

export function MeasurementForm({
  open,
  onClose,
  types,
  initialTypeId,
  measurement,
}: {
  open: boolean;
  onClose: () => void;
  types: MeasurementType[];
  initialTypeId?: string;
  measurement?: Measurement;
}) {
  const [typeId, setTypeId] = useState(initialTypeId ?? types[0]?.id ?? '');
  const [value, setValue] = useState<number | null>(null);
  const [date, setDate] = useState(dayKey(new Date()));
  const [time, setTime] = useState(isoToTimeInput(new Date().toISOString()));
  const [note, setNote] = useState('');
  const [source, setSource] = useState<'manual' | 'device'>('manual');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTypeId(measurement?.typeId ?? initialTypeId ?? types[0]?.id ?? '');
    setValue(measurement?.value ?? null);
    setDate(measurement ? dayKey(measurement.measuredAt) : dayKey(new Date()));
    setTime(isoToTimeInput(measurement?.measuredAt ?? new Date().toISOString()));
    setNote(measurement?.note ?? '');
    setSource(measurement?.source ?? 'manual');
    setError(null);
  }, [open, measurement, initialTypeId, types]);

  const type = types.find((t) => t.id === typeId);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ value, date });
    if (!parsed.success || !type) return setError('Vul een geldige waarde en datum in.');
    await saveMeasurement({
      id: measurement?.id ?? newId(),
      typeId: type.id,
      measuredAt: localInputToIso(date, time),
      value: parsed.data.value,
      unit: type.unit,
      note: note.trim() || null,
      source,
      serverUpdatedAt: measurement?.serverUpdatedAt ?? null,
      deletedAt: null,
    });
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={measurement ? 'Meting bewerken' : 'Meting toevoegen'}>
      <form onSubmit={submit} className="space-y-4 p-4">
        <label className="block">
          <span className="label">Wat</span>
          <select className="field mt-1" value={typeId} onChange={(e) => setTypeId(e.target.value)} disabled={!!measurement}>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.unit})
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Waarde{type ? ` (${type.unit})` : ''}</span>
          <NumberInput className="mt-1 h-12 text-left text-lg" value={value} onValue={setValue} autoFocus placeholder="0" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label">Datum</span>
            <input type="date" className="field mt-1" value={date} max={dayKey(new Date())} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">Tijd</span>
            <input type="time" className="field mt-1" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        </div>
        <label className="block">
          <span className="label">Bron</span>
          <select className="field mt-1" value={source} onChange={(e) => setSource(e.target.value as 'manual' | 'device')}>
            <option value="manual">Manueel</option>
            <option value="device">Apparaat (bv. slimme weegschaal)</option>
          </select>
        </label>
        <label className="block">
          <span className="label">Notitie</span>
          <input className="field mt-1" value={note} onChange={(e) => setNote(e.target.value)} placeholder="bv. nuchter gemeten" />
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" variant="primary" size="lg" block>
          Opslaan
        </Button>
      </form>
    </Sheet>
  );
}
