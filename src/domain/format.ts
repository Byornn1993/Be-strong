import type { ExerciseType, SetValues } from '@/lib/db/types';

const num = new Intl.NumberFormat('nl-BE', { maximumFractionDigits: 2 });
const int = new Intl.NumberFormat('nl-BE', { maximumFractionDigits: 0 });

export const formatNumber = (n: number) => num.format(n);
export const formatInt = (n: number) => int.format(n);

/** 1:05:09 of 5:09 */
export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
}

/** 1u 05m / 42m / 47s */
export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}u ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

export function formatDistance(m: number): string {
  return m >= 1000 ? `${formatNumber(m / 1000)} km` : `${formatInt(m)} m`;
}

export function formatVolume(kg: number): string {
  return `${formatInt(kg)} kg`;
}

/** Korte weergave van een set volgens het oefeningtype, bv. "24 kg × 8", "+10 kg × 6", "1:30". */
export function formatSet(type: ExerciseType, v: SetValues): string {
  const w = v.weightKg;
  const r = v.reps;
  switch (type) {
    case 'weight_reps':
      return `${formatNumber(w ?? 0)} kg × ${r ?? 0}`;
    case 'weighted_bodyweight':
      return w ? `+${formatNumber(w)} kg × ${r ?? 0}` : `${r ?? 0} reps`;
    case 'assisted_bodyweight':
      return w ? `−${formatNumber(w)} kg × ${r ?? 0}` : `${r ?? 0} reps`;
    case 'bodyweight_reps':
      // Waarden uit een import kunnen een gewicht bevatten; dat tonen we dan ook.
      return w ? `${formatNumber(w)} kg × ${r ?? 0}` : `${r ?? 0} reps`;
    case 'duration':
      return formatClock(v.durationSec ?? 0);
    case 'distance_duration': {
      const parts = [];
      if (v.distanceM) parts.push(formatDistance(v.distanceM));
      if (v.durationSec) parts.push(formatClock(v.durationSec));
      return parts.join(' · ') || '—';
    }
    case 'weight_distance':
      return `${formatNumber(w ?? 0)} kg · ${formatDistance(v.distanceM ?? 0)}`;
  }
}
