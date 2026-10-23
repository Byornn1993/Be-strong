import { writeFileSync, mkdirSync } from 'node:fs';
import { v5 as uuidv5 } from 'uuid';
import { LIBRARY } from './exercise-library.mjs';

// Vaste namespace voor standaardoefeningen; NOOIT wijzigen (ids zouden veranderen).
const NS = 'b3a4f0d2-6c1e-4a57-9e2b-5f0c7d1e9a10';

const names = new Set();
const rows = LIBRARY.map(([name, primary, secondary, equipment, type]) => {
  if (names.has(name)) throw new Error(`Dubbele oefening: ${name}`);
  names.add(name);
  return { id: uuidv5(`exercise:${name}`, NS), name, primaryMuscle: primary, secondaryMuscles: secondary, equipment, type };
});

mkdirSync('src/data', { recursive: true });
writeFileSync('src/data/exercises.json', JSON.stringify(rows, null, 2) + '\n');

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const arr = (a) => (a.length ? `array[${a.map(q).join(', ')}]::text[]` : `'{}'::text[]`);
const values = rows
  .map((r) => `  (${q(r.id)}, null, ${q(r.name)}, ${q(r.primaryMuscle)}, ${arr(r.secondaryMuscles)}, ${q(r.equipment)}, ${q(r.type)})`)
  .join(',\n');

const sql = `-- GEGENEREERD door scripts/gen-exercises.mjs. Niet met de hand aanpassen.
-- Standaardoefeningen (user_id null): leesbaar voor iedereen die is ingelogd, niet wijzigbaar.
insert into public.exercises (id, user_id, name, primary_muscle, secondary_muscles, equipment, type)
values
${values}
on conflict (id) do update set
  name = excluded.name,
  primary_muscle = excluded.primary_muscle,
  secondary_muscles = excluded.secondary_muscles,
  equipment = excluded.equipment,
  type = excluded.type;
`;
mkdirSync('supabase/migrations', { recursive: true });
writeFileSync('supabase/migrations/20261023000200_standard_exercises.sql', sql);
console.log(`${rows.length} standaardoefeningen gegenereerd.`);
