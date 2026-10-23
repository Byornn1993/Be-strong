import { beforeEach, describe, expect, it } from 'vitest';
import { closeDb, openDb, type BeStrongDb } from '@/lib/db/schema';
import { setSessionUser } from '@/lib/db/session';
import { saveMeasurement, saveWorkout } from '@/lib/db/repo';
import { pull, push, RemoteError, resolveConflict, syncOnce, type RemoteApi } from '@/lib/sync/engine';
import { enqueue } from '@/lib/sync/outbox';
import { workoutToPayload } from '@/lib/sync/mappers';
import { finishActive, saveActive, loadActive } from '@/features/workout/activeStore';
import { newActiveWorkout, workoutExerciseFrom } from '@/features/workout/logic';
import { BODYWEIGHT_TYPE_ID } from '@/data/measurementTypes';
import type { Measurement } from '@/lib/db/types';
import { exByName, set, workout } from './helpers';

const USER = 'aaaaaaaa-0000-4000-8000-00000000000a';

/** Nep-Supabase in het geheugen: bewaart rijen per tabel en geeft server-updated_at terug. */
class FakeRemote implements RemoteApi {
  tables = new Map<string, Map<string, Record<string, unknown>>>();
  calls: string[] = [];
  offline = false;
  failOn: string | null = null;
  private clock = Date.parse('2026-10-23T08:00:00Z');

  private tick() {
    this.clock += 1000;
    return new Date(this.clock).toISOString();
  }
  table(name: string) {
    if (!this.tables.has(name)) this.tables.set(name, new Map());
    return this.tables.get(name)!;
  }
  async upsert(table: string, row: Record<string, unknown>) {
    if (this.offline) throw new RemoteError('Failed to fetch', true);
    if (this.failOn === table) throw new RemoteError('check constraint', false);
    this.calls.push(`upsert:${table}:${row.id}`);
    const updated_at = this.tick();
    this.table(table).set(row.id as string, { ...row, updated_at });
    return updated_at;
  }
  async rpc(fn: string, payload: Record<string, unknown>) {
    if (this.offline) throw new RemoteError('Failed to fetch', true);
    this.calls.push(`rpc:${fn}:${payload.id ?? ''}`);
    if (fn === 'upsert_workout') {
      const updated_at = this.tick();
      // Server bewaart genormaliseerd; voor de test volstaat het aggregaat in de pull-vorm.
      const p = payload as { exercises: { sets: unknown[] }[] } & Record<string, unknown>;
      this.table('workouts').set(payload.id as string, {
        ...p,
        updated_at,
        workout_exercises: p.exercises.map((e) => ({ ...e, workout_sets: e.sets })),
      });
      return updated_at;
    }
    return null;
  }
  async fetchSince(table: string, _select: string, since: string | null) {
    if (this.offline) throw new RemoteError('Failed to fetch', true);
    return [...this.table(table).values()]
      .filter((r) => !since || Date.parse(r.updated_at as string) > Date.parse(since))
      .sort((a, b) => Date.parse(a.updated_at as string) - Date.parse(b.updated_at as string));
  }
  /** Simuleert een wijziging vanaf een ander toestel. */
  serverEdit(table: string, id: string, patch: Record<string, unknown>) {
    const cur = this.table(table).get(id)!;
    this.table(table).set(id, { ...cur, ...patch, updated_at: this.tick() });
  }
}

let db: BeStrongDb;
let remote: FakeRemote;

function measurement(value: number, id = crypto.randomUUID()): Measurement {
  return { id, typeId: BODYWEIGHT_TYPE_ID, measuredAt: '2026-10-22T08:00:00+02:00', value, unit: 'kg', note: null, source: 'manual', serverUpdatedAt: null, deletedAt: null };
}

beforeEach(async () => {
  closeDb();
  setSessionUser(USER);
  db = openDb(`${USER}-${crypto.randomUUID()}`);
  await db.open();
  remote = new FakeRemote();
});

describe('outbox', () => {
  it('voegt wijzigingen aan dezelfde entiteit samen en behoudt de volgorde', async () => {
    const m = measurement(80);
    await saveMeasurement(m);
    await saveMeasurement(measurement(70));
    await saveMeasurement({ ...m, value: 81 });
    const ops = await db.outbox.orderBy('seq').toArray();
    expect(ops).toHaveLength(2);
    expect(ops[0]).toMatchObject({ key: `measurements:${m.id}`, version: 2 });
    expect((ops[0] as { row: { value: number } }).row.value).toBe(81);
  });

  it('een wijziging tijdens het versturen gaat niet verloren', async () => {
    const m = measurement(80);
    await saveMeasurement(m);
    const slow: RemoteApi = {
      ...remote,
      upsert: async (t, row) => {
        await saveMeasurement({ ...m, value: 82 }); // gebruiker wijzigt terwijl de request loopt
        return remote.upsert(t, row);
      },
      rpc: remote.rpc.bind(remote),
      fetchSince: remote.fetchSince.bind(remote),
    };
    await push(db, slow);
    expect(await db.outbox.count()).toBe(1); // nieuwe versie wacht nog
    await push(db, remote);
    expect(remote.table('body_measurements').get(m.id)!.value).toBe(82);
  });
});

describe('sync', () => {
  it('pusht de wachtrij en zet serverUpdatedAt', async () => {
    const m = measurement(80);
    await saveMeasurement(m);
    const r = await syncOnce(db, remote);
    expect(r.pushed).toBe(1);
    expect(await db.outbox.count()).toBe(0);
    expect((await db.measurements.get(m.id))!.serverUpdatedAt).toBeTruthy();
  });

  it('offline: niets gaat verloren, later wordt alles verstuurd', async () => {
    remote.offline = true;
    await saveMeasurement(measurement(80));
    await expect(syncOnce(db, remote)).rejects.toMatchObject({ network: true });
    expect(await db.outbox.count()).toBe(1);
    remote.offline = false;
    await syncOnce(db, remote);
    expect(await db.outbox.count()).toBe(0);
    expect(remote.table('body_measurements').size).toBe(1);
  });

  it('een serverfout blokkeert de rest van de wachtrij (volgorde blijft gegarandeerd)', async () => {
    remote.failOn = 'body_measurements';
    await saveMeasurement(measurement(80));
    await saveWorkout(workout('2026-10-22T08:00:00+02:00', []));
    await expect(push(db, remote)).rejects.toThrow('check constraint');
    expect(await db.outbox.count()).toBe(2);
    expect((await db.outbox.orderBy('seq').first())!.lastError).toBe('check constraint');
    expect(remote.calls).toEqual([]);
  });

  it('pull neemt serverwijzigingen over als er lokaal niets openstaat', async () => {
    const m = measurement(80);
    await saveMeasurement(m);
    await syncOnce(db, remote);
    remote.serverEdit('body_measurements', m.id, { value: 79 });
    await pull(db, remote);
    expect((await db.measurements.get(m.id))!.value).toBe(79);
  });

  it('conflict: nooit stilzwijgend overschrijven; gebruiker kiest', async () => {
    const m = measurement(80);
    await saveMeasurement(m);
    await syncOnce(db, remote);
    // Ander toestel wijzigt op de server, hier wordt offline ook gewijzigd.
    remote.serverEdit('body_measurements', m.id, { value: 79 });
    await saveMeasurement({ ...(await db.measurements.get(m.id))!, value: 85 });

    const r = await syncOnce(db, remote);
    expect(r.conflicts).toBe(1);
    expect(r.blockedBy).not.toBeNull();
    expect(remote.table('body_measurements').get(m.id)!.value).toBe(79); // server niet overschreven
    expect((await db.measurements.get(m.id))!.value).toBe(85); // lokaal niet overschreven

    await resolveConflict(db, `measurements:${m.id}`, 'mine');
    await syncOnce(db, remote);
    expect(remote.table('body_measurements').get(m.id)!.value).toBe(85);
  });

  it('conflict oplossen met de serverversie', async () => {
    const m = measurement(80);
    await saveMeasurement(m);
    await syncOnce(db, remote);
    remote.serverEdit('body_measurements', m.id, { value: 79 });
    await saveMeasurement({ ...(await db.measurements.get(m.id))!, value: 85 });
    await syncOnce(db, remote);
    await resolveConflict(db, `measurements:${m.id}`, 'server');
    expect((await db.measurements.get(m.id))!.value).toBe(79);
    expect(await db.outbox.count()).toBe(0);
  });
});

describe('Finish', () => {
  it('overleeft een "refresh" (actieve workout staat in IndexedDB)', async () => {
    const a = newActiveWorkout('Upper', new Date());
    a.exercises = [workoutExerciseFrom(exByName('Chin Up'), 2)];
    await saveActive(a);
    closeDb();
    db = openDb(db.name.replace('bestrong-', ''));
    expect((await loadActive())!.exercises[0]!.sets).toHaveLength(2);
  });

  it('is idempotent: dubbel tikken levert één workout en één outbox-operatie op', async () => {
    const a = newActiveWorkout('Upper', new Date(Date.now() - 3600_000));
    const we = workoutExerciseFrom(exByName('Chin Up'), 2);
    we.sets[0] = { ...set(10, 8), id: we.sets[0]!.id };
    a.exercises = [we];
    await saveActive(a);

    const [w1, w2] = await Promise.all([
      finishActive(a.id, { keepUnchecked: false, note: null }),
      finishActive(a.id, { keepUnchecked: false, note: null }),
    ]);
    expect(w1.id).toBe(w2.id);
    expect(await db.workouts.count()).toBe(1);
    expect(await db.outbox.count()).toBe(1);
    expect(await loadActive()).toBeNull();
    // Niet-afgevinkte set weggegooid
    expect(w1.exercises[0]!.sets).toHaveLength(1);
    expect(w1.durationSec).toBeGreaterThanOrEqual(3599);

    // Opnieuw versturen (bv. na offline/online) → server heeft nog steeds één workout.
    await syncOnce(db, remote);
    await enqueue(db, { kind: 'rpc', key: `workouts:${w1.id}`, fn: 'upsert_workout', payload: workoutToPayload(w1) });
    await syncOnce(db, remote);
    expect(remote.calls.filter((c) => c.startsWith('rpc:upsert_workout'))).toHaveLength(2);
    expect(remote.table('workouts').size).toBe(1);
  });
});
