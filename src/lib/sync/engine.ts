import type { z } from 'zod';
import type { BeStrongDb } from '@/lib/db/schema';
import { ack, pendingKeys } from './outbox';
import * as M from './mappers';
import { entityKey, type Conflict, type LocalTable, type OutboxOp, type RpcName, type SimpleTable } from './types';

// Sync-engine. Volgorde per ronde:
//  1. PULL: nieuwe/gewijzigde rijen sinds de laatste cursor ophalen (incl. soft deletes).
//     - Geen lokale wijziging in de wachtrij → serverversie overnemen.
//     - Wel een lokale wijziging, en de server veranderde sinds onze basisversie → CONFLICT
//       (nooit stilzwijgend overschrijven; de gebruiker kiest in Instellingen › Synchronisatie).
//  2. PUSH: de wachtrij in volgorde versturen met idempotente upserts/RPC's. Stopt bij de eerste fout,
//     zodat afhankelijke wijzigingen nooit in de verkeerde volgorde aankomen.

export class RemoteError extends Error {
  constructor(
    message: string,
    readonly network: boolean,
  ) {
    super(message);
  }
}

export interface RemoteApi {
  upsert(table: SimpleTable, row: Record<string, unknown>): Promise<string>;
  rpc(fn: RpcName, payload: Record<string, unknown>): Promise<unknown>;
  fetchSince(table: string, select: string, since: string | null, from: number, to: number): Promise<unknown[]>;
}

interface PullSpec<S extends z.ZodTypeAny> {
  remote: string;
  local: LocalTable;
  select: string;
  schema: S;
  map: (r: z.infer<S>) => { id: string; serverUpdatedAt: string | null };
}

const spec = <S extends z.ZodTypeAny>(s: PullSpec<S>) => s;

// Volgorde is belangrijk: ouders vóór kinderen.
const PULLS = [
  spec({ remote: 'profiles', local: 'profile', select: '*', schema: M.remoteProfile, map: M.profileFromRemote }),
  spec({ remote: 'exercises', local: 'exercises', select: '*', schema: M.remoteExercise, map: M.exerciseFromRemote }),
  spec({ remote: 'exercise_prefs', local: 'exercisePrefs', select: '*', schema: M.remoteExercisePref, map: M.exercisePrefFromRemote }),
  spec({ remote: 'workout_templates', local: 'templates', select: M.TEMPLATE_SELECT, schema: M.remoteTemplate, map: M.templateFromRemote }),
  spec({ remote: 'workouts', local: 'workouts', select: M.WORKOUT_SELECT, schema: M.remoteWorkout, map: M.workoutFromRemote }),
  spec({ remote: 'measurement_types', local: 'measurementTypes', select: '*', schema: M.remoteMeasurementType, map: M.measurementTypeFromRemote }),
  spec({ remote: 'body_measurements', local: 'measurements', select: '*', schema: M.remoteMeasurement, map: M.measurementFromRemote }),
  spec({ remote: 'goals', local: 'goals', select: '*', schema: M.remoteGoal, map: M.goalFromRemote }),
  spec({ remote: 'dashboard_widgets', local: 'widgets', select: '*', schema: M.remoteWidget, map: M.widgetFromRemote }),
] as const;

const PAGE = 500;
const OVERLAP_MS = 60_000;

export function sameTimestamp(a: string | null, b: string | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return Date.parse(a) === Date.parse(b);
}

function localTable(db: BeStrongDb, t: LocalTable) {
  return db.table(t);
}

/** Welke lokale tabel/entiteit hoort bij een outbox-operatie (voor het bijwerken van serverUpdatedAt). */
function targetOf(op: OutboxOp): { table: LocalTable; id: string } | null {
  const [table, id] = op.key.split(':') as [string, string | undefined];
  const known: LocalTable[] = ['exercises', 'exercisePrefs', 'templates', 'workouts', 'measurementTypes', 'measurements', 'goals', 'widgets', 'profile'];
  return id && (known as string[]).includes(table) ? { table: table as LocalTable, id } : null;
}

export interface SyncResult {
  pulled: number;
  pushed: number;
  conflicts: number;
  blockedBy: OutboxOp | null;
}

export async function pull(db: BeStrongDb, api: RemoteApi): Promise<{ pulled: number; conflicts: number }> {
  let pulled = 0;
  let conflicts = 0;
  for (const s of PULLS) {
    const cursorKey = `cursor:${s.remote}`;
    const cursor = ((await db.meta.get(cursorKey))?.value as string | undefined) ?? null;
    const since = cursor ? new Date(Date.parse(cursor) - OVERLAP_MS).toISOString() : null;
    let maxSeen = cursor;
    for (let from = 0; ; from += PAGE) {
      const raw = await api.fetchSince(s.remote, s.select, since, from, from + PAGE - 1);
      const rows = raw.map((r) => s.map(s.schema.parse(r) as never));
      const pending = await pendingKeys(db);
      await db.transaction('rw', [localTable(db, s.local), db.conflicts], async () => {
        for (const row of rows) {
          const key = entityKey(s.local, row.id);
          const local = (await localTable(db, s.local).get(row.id)) as { serverUpdatedAt: string | null } | undefined;
          if (pending.has(key)) {
            if (local && !sameTimestamp(local.serverUpdatedAt, row.serverUpdatedAt)) {
              const c: Conflict = {
                key,
                table: s.local,
                entityId: row.id,
                local,
                remote: row,
                localBase: local.serverUpdatedAt,
                remoteUpdatedAt: row.serverUpdatedAt!,
                detectedAt: new Date().toISOString(),
              };
              await db.conflicts.put(c);
              conflicts++;
            }
            continue;
          }
          await localTable(db, s.local).put(row);
          pulled++;
        }
      });
      for (const row of rows) if (!maxSeen || Date.parse(row.serverUpdatedAt!) > Date.parse(maxSeen)) maxSeen = row.serverUpdatedAt;
      if (raw.length < PAGE) break;
    }
    if (maxSeen !== cursor) await db.meta.put({ key: cursorKey, value: maxSeen });
  }
  return { pulled, conflicts };
}

export async function push(db: BeStrongDb, api: RemoteApi): Promise<{ pushed: number; blockedBy: OutboxOp | null }> {
  let pushed = 0;
  const conflicted = new Set((await db.conflicts.toCollection().primaryKeys()) as string[]);
  const ops = await db.outbox.orderBy('seq').toArray();
  for (const op of ops) {
    // Een entiteit in conflict wacht op de keuze van de gebruiker. Alles daarna ook,
    // want latere operaties kunnen ervan afhangen.
    if (conflicted.has(op.key)) return { pushed, blockedBy: op };
    try {
      const result = op.kind === 'upsert' ? await api.upsert(op.table, op.row) : await api.rpc(op.fn, op.payload);
      const target = targetOf(op);
      if (target && typeof result === 'string') {
        await localTable(db, target.table).update(target.id, { serverUpdatedAt: result });
      }
      await ack(db, op);
      pushed++;
    } catch (e) {
      const err = e instanceof RemoteError ? e : new RemoteError(e instanceof Error ? e.message : String(e), false);
      if (!err.network) {
        await db.outbox.update(op.seq!, { attempts: op.attempts + 1, lastError: err.message });
      }
      throw err;
    }
  }
  return { pushed, blockedBy: null };
}

export async function syncOnce(db: BeStrongDb, api: RemoteApi): Promise<SyncResult> {
  const p = await pull(db, api);
  const q = await push(db, api);
  return { pulled: p.pulled, conflicts: p.conflicts, pushed: q.pushed, blockedBy: q.blockedBy };
}

/** Conflict oplossen: eigen versie houden (wordt opnieuw verstuurd) of serverversie nemen. */
export async function resolveConflict(db: BeStrongDb, key: string, choice: 'mine' | 'server'): Promise<void> {
  const c = await db.conflicts.get(key);
  if (!c) return;
  const table = localTable(db, c.table);
  await db.transaction('rw', [table, db.conflicts, db.outbox], async () => {
    if (choice === 'server') {
      await table.put(c.remote);
      await db.outbox.where('key').equals(key).delete();
    } else {
      // Onze versie wordt nu gebaseerd op de laatste serverversie.
      await table.update(c.entityId, { serverUpdatedAt: c.remoteUpdatedAt });
    }
    await db.conflicts.delete(key);
  });
}
