import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { AUTH_STUB } from './harness';

it('supabase/setup-productie.sql installeert de volledige database in één keer', async () => {
  const db = new PGlite();
  await db.exec(AUTH_STUB);
  await db.exec(readFileSync('supabase/setup-productie.sql', 'utf8'));
  const ex = await db.query<{ n: number }>('select count(*)::int as n from public.exercises where user_id is null');
  const mt = await db.query<{ n: number }>('select count(*)::int as n from public.measurement_types');
  const rls = await db.query<{ n: number }>(`select count(*)::int as n from pg_tables where schemaname = 'public' and rowsecurity`);
  expect(ex.rows[0]!.n).toBe(111);
  expect(mt.rows[0]!.n).toBe(8);
  expect(rls.rows[0]!.n).toBe(13);
});
