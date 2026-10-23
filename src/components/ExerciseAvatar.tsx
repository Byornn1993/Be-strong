import type { Muscle } from '@/lib/db/types';
import { MUSCLE_LABELS } from '@/domain/exerciseTypes';

/** Afbeelding van een oefening, of een nette fallback: initiaal + spiergroep. */
export function ExerciseAvatar({ name, muscle, imageUrl, size = 44 }: { name: string; muscle?: Muscle; imageUrl?: string | null; size?: number }) {
  if (imageUrl) {
    return <img src={imageUrl} alt="" width={size} height={size} loading="lazy" className="shrink-0 rounded-xl bg-surface-2 object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <div
      className="flex shrink-0 flex-col items-center justify-center rounded-xl bg-primary-soft text-accent"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <span className="text-base font-bold leading-none">{name.trim().charAt(0).toUpperCase()}</span>
      {muscle && size >= 44 && <span className="mt-0.5 text-[8px] uppercase tracking-wide text-accent/70">{MUSCLE_LABELS[muscle].slice(0, 6)}</span>}
    </div>
  );
}
