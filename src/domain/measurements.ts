import type { Measurement, MeasurementType } from '@/lib/db/types';

export interface MeasurementSummary {
  current: Measurement | null;
  previous: Measurement | null;
  diff: number | null;
  /** Procentueel verschil; null waar dat niet zinvol is (bv. bij een percentage zoals vetpercentage). */
  diffPct: number | null;
}

/** Huidige vs. vorige meting. Er worden geen medische waarden afgeleid. */
export function summarizeMeasurements(type: Pick<MeasurementType, 'id' | 'kind'>, all: readonly Measurement[]): MeasurementSummary {
  const list = all.filter((m) => m.typeId === type.id && !m.deletedAt).sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
  const current = list.at(-1) ?? null;
  const previous = list.at(-2) ?? null;
  if (!current || !previous) return { current, previous, diff: null, diffPct: null };
  const diff = Math.round((current.value - previous.value) * 100) / 100;
  const diffPct = type.kind !== 'percent' && previous.value !== 0 ? Math.round((diff / previous.value) * 1000) / 10 : null;
  return { current, previous, diff, diffPct };
}

export type MeasurePeriod = '1m' | '3m' | '6m' | '1y' | 'all';

export function inPeriod(list: readonly Measurement[], p: MeasurePeriod, now: Date): Measurement[] {
  if (p === 'all') return [...list];
  const months = { '1m': 1, '3m': 3, '6m': 6, '1y': 12 }[p];
  const from = new Date(now.getFullYear(), now.getMonth() - months, now.getDate()).getTime();
  return list.filter((m) => Date.parse(m.measuredAt) >= from);
}
