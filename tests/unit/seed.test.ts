import { describe, expect, it } from 'vitest';
import { buildSeedTemplates } from '@/features/settings/seedTemplates';
import { library } from './helpers';

describe('seed-templates', () => {
  const { templates, missing } = buildSeedTemplates('aaaaaaaa-0000-4000-8000-00000000000a', library);

  it('alle oefeningen uit de seed bestaan in de standaardbibliotheek', () => {
    expect(missing).toEqual([]);
  });

  it('bevat de zes templates met het juiste aantal oefeningen en sets', () => {
    expect(templates.map((t) => [t.name, t.exercises.length])).toEqual([
      ['Upper', 8],
      ['Only Upper 1', 6],
      ['Only Upper 2', 6],
      ['Lower Dag 1', 8],
      ['Lower Dag 2', 8],
      ['Armdag', 6],
    ]);
    expect(templates[0]!.exercises.map((e) => e.sets.length)).toEqual([4, 3, 3, 3, 3, 3, 4, 3]);
  });

  it('is idempotent (zelfde ids bij opnieuw importeren)', () => {
    const again = buildSeedTemplates('aaaaaaaa-0000-4000-8000-00000000000a', library);
    expect(again.templates.map((t) => t.id)).toEqual(templates.map((t) => t.id));
  });
});
