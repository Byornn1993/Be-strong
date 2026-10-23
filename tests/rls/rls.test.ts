import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asUser, createDb, USER_A, USER_B } from './harness';
import exercises from '../../src/data/exercises.json';

// Draait alle migraties op een echte (embedded) Postgres en controleert RLS met twee gebruikers.
// Aanvullend kun je dezelfde scenario's tegen `supabase start` draaien (zie README).

const benchId = exercises.find((e) => e.name === 'Bench Press (Dumbbell)')!.id;
const uuid = () => crypto.randomUUID();

function workoutPayload(id: string, exerciseId: string, extra: Record<string, unknown> = {}) {
  const weId = uuid();
  return {
    id,
    name: 'Upper',
    started_at: '2026-10-20T21:30:00+02:00',
    ended_at: '2026-10-20T22:30:00+02:00',
    duration_sec: 3600,
    exercises: [
      {
        id: weId,
        exercise_id: exerciseId,
        exercise_name: 'Bench Press (Dumbbell)',
        exercise_type: 'weight_reps',
        position: 0,
        sets: [
          { id: uuid(), position: 0, set_type: 'normal', weight_kg: 24, reps: 8, completed: true },
          { id: uuid(), position: 1, set_type: 'normal', weight_kg: 24, reps: 7, completed: true },
        ],
      },
    ],
    ...extra,
  };
}

let db: PGlite;
const workoutA = uuid();
const exerciseA = uuid();

beforeAll(async () => {
  db = await createDb();
  await asUser(db, USER_A, async (tx) => {
    await tx.query(
      `insert into public.exercises (id, user_id, name, primary_muscle, equipment, type) values ($1, $2, 'Geheime oefening', 'chest', 'other', 'weight_reps')`,
      [exerciseA, USER_A],
    );
    await tx.query('select public.upsert_workout($1::jsonb)', [JSON.stringify(workoutPayload(workoutA, benchId))]);
  });
});

describe('RLS', () => {
  it('maakt automatisch een profiel aan per gebruiker', async () => {
    const r = await asUser(db, USER_A, (tx) => tx.query('select id from public.profiles'));
    expect(r.rows).toEqual([{ id: USER_A }]);
  });

  it('gebruiker A ziet de eigen workout met oefeningen en sets', async () => {
    const r = await asUser(db, USER_A, (tx) =>
      tx.query<{ n: number }>(
        `select count(*)::int as n from public.workout_sets s join public.workout_exercises we on we.id = s.workout_exercise_id where we.workout_id = $1`,
        [workoutA],
      ),
    );
    expect(r.rows[0]!.n).toBe(2);
  });

  it('gebruiker B kan de data van A niet lezen, ook niet met de juiste UUID', async () => {
    await asUser(db, USER_B, async (tx) => {
      expect((await tx.query('select * from public.workouts where id = $1', [workoutA])).rows).toHaveLength(0);
      expect((await tx.query('select * from public.workout_exercises')).rows).toHaveLength(0);
      expect((await tx.query('select * from public.workout_sets')).rows).toHaveLength(0);
      expect((await tx.query('select * from public.exercises where id = $1', [exerciseA])).rows).toHaveLength(0);
      expect((await tx.query('select * from public.profiles where id = $1', [USER_A])).rows).toHaveLength(0);
    });
  });

  it('gebruiker B kan de workout van A niet wijzigen of verwijderen', async () => {
    await asUser(db, USER_B, async (tx) => {
      const u = await tx.query(`update public.workouts set name = 'gehackt' where id = $1`, [workoutA]);
      expect(u.affectedRows).toBe(0);
      const d = await tx.query('delete from public.workouts where id = $1', [workoutA]);
      expect(d.affectedRows).toBe(0);
    });
    const r = await asUser(db, USER_A, (tx) => tx.query<{ name: string }>('select name from public.workouts where id = $1', [workoutA]));
    expect(r.rows[0]!.name).toBe('Upper');
  });

  it('gebruiker B kan de workout van A niet overschrijven via de RPC', async () => {
    await expect(
      asUser(db, USER_B, (tx) =>
        tx.query('select public.upsert_workout($1::jsonb)', [JSON.stringify(workoutPayload(workoutA, benchId, { name: 'gehackt' }))]),
      ),
    ).rejects.toThrow();
    const r = await asUser(db, USER_A, (tx) => tx.query<{ name: string }>('select name from public.workouts where id = $1', [workoutA]));
    expect(r.rows[0]!.name).toBe('Upper');
  });

  it('gebruiker B kan geen sets toevoegen aan een oefening van A', async () => {
    const weA = await asUser(db, USER_A, (tx) =>
      tx.query<{ id: string }>('select id from public.workout_exercises where workout_id = $1', [workoutA]),
    );
    await expect(
      asUser(db, USER_B, (tx) =>
        tx.query(
          `insert into public.workout_sets (id, workout_exercise_id, user_id, position) values ($1, $2, $3, 9)`,
          [uuid(), weA.rows[0]!.id, USER_B],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('gebruiker B kan de eigen oefening van A niet gebruiken in een template', async () => {
    const t = uuid();
    await expect(
      asUser(db, USER_B, (tx) =>
        tx.query('select public.upsert_template($1::jsonb)', [
          JSON.stringify({ id: t, name: 'X', exercises: [{ id: uuid(), exercise_id: exerciseA, position: 0, sets: [] }] }),
        ]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('niemand kan rijen aanmaken op naam van een andere gebruiker', async () => {
    await expect(
      asUser(db, USER_B, (tx) =>
        tx.query(`insert into public.workout_templates (id, user_id, name) values ($1, $2, 'vals')`, [uuid(), USER_A]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('standaardoefeningen zijn leesbaar maar niet wijzigbaar', async () => {
    await asUser(db, USER_B, async (tx) => {
      const r = await tx.query('select id from public.exercises where id = $1', [benchId]);
      expect(r.rows).toHaveLength(1);
      const u = await tx.query(`update public.exercises set name = 'x' where id = $1`, [benchId]);
      expect(u.affectedRows).toBe(0);
      const d = await tx.query('delete from public.exercises where id = $1', [benchId]);
      expect(d.affectedRows).toBe(0);
    });
    await expect(
      asUser(db, USER_B, (tx) =>
        tx.query(`insert into public.exercises (id, user_id, name, primary_muscle, equipment, type) values ($1, null, 'x', 'chest', 'other', 'weight_reps')`, [uuid()]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('anon (niet ingelogd) ziet niets', async () => {
    await expect(asUser(db, null, (tx) => tx.query('select * from public.exercises'))).rejects.toThrow(/permission denied/);
  });

  it('upsert_workout is idempotent: dubbel versturen levert één workout op', async () => {
    const id = uuid();
    const p = JSON.stringify(workoutPayload(id, benchId));
    await asUser(db, USER_B, async (tx) => {
      await tx.query('select public.upsert_workout($1::jsonb)', [p]);
      await tx.query('select public.upsert_workout($1::jsonb)', [p]);
    });
    const r = await asUser(db, USER_B, (tx) =>
      tx.query<{ w: number; s: number }>(
        `select (select count(*)::int from public.workouts where id = $1) as w,
                (select count(*)::int from public.workout_sets s join public.workout_exercises we on we.id = s.workout_exercise_id where we.workout_id = $1) as s`,
        [id],
      ),
    );
    expect(r.rows[0]).toEqual({ w: 1, s: 2 });
  });

  it('import_workouts is idempotent en overschrijft niets', async () => {
    const id = uuid();
    const payload = JSON.stringify({ exercises: [], workouts: [{ ...workoutPayload(id, benchId), source: 'strong_import', source_key: 'k1' }] });
    const first = await asUser(db, USER_B, (tx) => tx.query<{ r: { workouts_created: number } }>('select public.import_workouts($1::jsonb) as r', [payload]));
    const second = await asUser(db, USER_B, (tx) => tx.query<{ r: { workouts_created: number; workouts_skipped: number } }>('select public.import_workouts($1::jsonb) as r', [payload]));
    expect(first.rows[0]!.r.workouts_created).toBe(1);
    expect(second.rows[0]!.r).toMatchObject({ workouts_created: 0, workouts_skipped: 1 });
  });

  it('updated_at wordt door de server gezet', async () => {
    const r = await asUser(db, USER_A, (tx) =>
      tx.query<{ updated_at: Date }>(`update public.workouts set note = 'x', updated_at = '2000-01-01' where id = $1 returning updated_at`, [workoutA]),
    );
    expect(r.rows[0]!.updated_at.getFullYear()).toBeGreaterThan(2000);
  });
});
