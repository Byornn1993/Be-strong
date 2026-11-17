import { PGlite } from '@electric-sql/pglite';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { AUTH_STUB, USER_A, asUser } from './harness';

// Productie draaide de migraties van vóór 'duration_level'. Deze test bouwt die oude toestand na (de
// bestanden zoals ze in git stonden op commit 2f91a3f) en voert daarna de nieuwe migratie uit.
const OLD = '2f91a3f';
const old = (f: string) => execSync(`git show ${OLD}:supabase/migrations/${f}`, { encoding: 'utf8' });

it('migratie tijd + stand werkt op de bestaande productiedatabase en is herhaalbaar', async () => {
  const db = new PGlite();
  await db.exec(AUTH_STUB);
  for (const f of [
    '20261023000100_schema.sql',
    '20261023000200_standard_exercises.sql',
    '20261023000300_rls.sql',
    '20261023000400_rpc.sql',
    '20261023000500_measurement_types.sql',
    '20261117000100_cardio_exercises.sql',
  ])
    await db.exec(old(f));
  await db.exec(`insert into auth.users (id, email) values ('${USER_A}', 'a@test');`);

  // Een bestaande workout met de oude cardio-snapshot blijft ongemoeid.
  const migration = readFileSync('supabase/migrations/20261117000200_cardio_tijd_stand.sql', 'utf8');
  await db.exec(migration);
  await db.exec(migration); // tweede keer: geen fout

  const types = await db.query<{ name: string; type: string }>(
    `select name, type from public.exercises where user_id is null and name in ('Cycling (Indoor)', 'Rowing (Machine)', 'Stair Climber (Machine)', 'Jump Rope') order by name`,
  );
  expect(types.rows).toEqual([
    { name: 'Cycling (Indoor)', type: 'duration_level' },
    { name: 'Jump Rope', type: 'duration' },
    { name: 'Rowing (Machine)', type: 'distance_duration' },
    { name: 'Stair Climber (Machine)', type: 'duration_level' },
  ]);
  const count = await db.query<{ n: number }>(`select count(*)::int as n from public.exercises where type = 'duration_level'`);
  expect(count.rows[0]!.n).toBe(8);

  // Een workout met tijd + stand bewaren via de RPC van de app.
  await asUser(db, USER_A, async (tx) => {
    await tx.query(`select public.upsert_workout($1::jsonb)`, [
      JSON.stringify({
        id: '11111111-0000-4000-8000-000000000001',
        name: 'Cardio',
        started_at: '2026-11-17T10:00:00+01:00',
        ended_at: '2026-11-17T10:30:00+01:00',
        duration_sec: 1800,
        note: null,
        template_id: null,
        source: 'app',
        source_key: null,
        deleted_at: null,
        exercises: [
          {
            id: '11111111-0000-4000-8000-000000000002',
            exercise_id: 'a97ace8a-9adb-58f1-832d-92f9af87072d',
            exercise_name: 'Cycling (Indoor)',
            exercise_type: 'duration_level',
            position: 0,
            superset_group: null,
            rest_sec: null,
            note: null,
            sets: [
              {
                id: '11111111-0000-4000-8000-000000000003',
                position: 0,
                set_type: 'normal',
                weight_kg: null,
                reps: 8,
                duration_sec: 1800,
                distance_m: null,
                rpe: null,
                completed: true,
                completed_at: '2026-11-17T10:30:00+01:00',
                note: null,
              },
            ],
          },
        ],
      }),
    ]);
  });
  const set = await db.query<{ reps: number; duration_sec: number }>(`select reps, duration_sec from public.workout_sets`);
  expect(set.rows).toEqual([{ reps: 8, duration_sec: 1800 }]);
});
