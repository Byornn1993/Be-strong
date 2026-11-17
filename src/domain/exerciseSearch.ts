import type { Exercise, Muscle } from '@/lib/db/types';
import { EQUIPMENT_LABELS } from './exerciseTypes';

/** Filter in de oefeningenlijst: een spiergroep, of de extra groep "cardio". */
export type MuscleFilter = Muscle | 'cardio';

/** Cardio = afstand/tijd-oefeningen (lopen, fietsen, roeien…) en tijd-oefeningen voor het hele lichaam (touwspringen, trap). */
export function isCardio(e: Pick<Exercise, 'type' | 'primaryMuscle'>): boolean {
  return e.type === 'distance_duration' || e.type === 'duration_level' || (e.type === 'duration' && e.primaryMuscle === 'full_body');
}

// Oefeningnamen zijn Engels (zoals in Strong). Met deze Nederlandse zoekwoorden vind je ze ook.
const DUTCH_WORDS: [english: string, dutch: string[]][] = [
  ['running', ['lopen', 'hardlopen', 'rennen', 'joggen']],
  ['treadmill', ['loopband']],
  ['cycling', ['fietsen', 'fiets', 'hometrainer', 'spinning']],
  ['rowing', ['roeien', 'roeimachine']],
  ['walking', ['wandelen', 'stappen']],
  ['stair', ['trap', 'traplopen', 'trappen']],
  ['elliptical', ['crosstrainer']],
  ['jump rope', ['touwspringen', 'springtouw']],
];

function searchText(e: Exercise): string {
  const name = e.name.toLowerCase();
  const extra = DUTCH_WORDS.filter(([en]) => name.includes(en)).flatMap(([, nl]) => nl);
  if (isCardio(e)) extra.push('cardio');
  return [name, EQUIPMENT_LABELS[e.equipment].toLowerCase(), ...extra].join(' ');
}

export function filterExercises(list: readonly Exercise[], q: string, muscle: MuscleFilter | null): Exercise[] {
  const terms = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return list.filter((e) => {
    if (muscle === 'cardio' ? !isCardio(e) : muscle && e.primaryMuscle !== muscle && !e.secondaryMuscles.includes(muscle)) return false;
    if (!terms.length) return true;
    const text = searchText(e);
    return terms.every((t) => text.includes(t));
  });
}
