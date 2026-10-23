import { v5 as uuidv5 } from 'uuid';
import seed from '@/data/seed-templates.json';
import type { Exercise, Template } from '@/lib/db/types';
import { normalizeExerciseName } from '@/domain/import/strong';

// "Importeer standaardtemplates": idempotent dankzij deterministische ids per gebruiker.
// Opnieuw importeren werkt een bestaande seed-template NIET bij (eigen wijzigingen blijven).
const NS = '9b2d1c7e-5a3f-4e8b-b6c1-2d4e6f8a0b13';

export function buildSeedTemplates(userId: string, library: readonly Exercise[]): { templates: Template[]; missing: string[] } {
  const byNorm = new Map(library.filter((e) => !e.deletedAt).map((e) => [normalizeExerciseName(e.name), e]));
  const missing: string[] = [];
  const templates = seed.templates.map((t, ti): Template => {
    const tid = uuidv5(`${userId}:seed-template:${t.key}`, NS);
    return {
      id: tid,
      name: t.name,
      folder: null,
      note: null,
      sortOrder: ti,
      serverUpdatedAt: null,
      deletedAt: null,
      exercises: t.exercises.flatMap((e, ei) => {
        const ex = byNorm.get(normalizeExerciseName(e.name));
        if (!ex) {
          missing.push(e.name);
          return [];
        }
        const teId = uuidv5(`${tid}:exercise:${ei}`, NS);
        return [
          {
            id: teId,
            exerciseId: ex.id,
            supersetGroup: null,
            restSec: null,
            note: null,
            sets: Array.from({ length: e.sets }, (_, si) => ({
              id: uuidv5(`${teId}:set:${si}`, NS),
              type: 'normal' as const,
              reps: null,
              weightKg: null,
              durationSec: null,
              distanceM: null,
            })),
          },
        ];
      }),
    };
  });
  return { templates, missing };
}
