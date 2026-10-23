import type { BeStrongDb } from '@/lib/db/schema';
import type { OutboxOp, RpcName, SimpleTable } from './types';

type NewOp =
  | { kind: 'upsert'; key: string; table: SimpleTable; row: Record<string, unknown> }
  | { kind: 'rpc'; key: string; fn: RpcName; payload: Record<string, unknown> };

/**
 * Zet een wijziging in de wachtrij. Bestaat er al een openstaande wijziging voor dezelfde entiteit,
 * dan wordt die IN PLAATS bijgewerkt (zelfde volgnummer). Zo blijft de volgorde tussen afhankelijke
 * entiteiten behouden (eerst de oefening, dan de template die ernaar verwijst) en groeit de wachtrij niet.
 * Moet binnen een Dexie-transactie op `db.outbox` aangeroepen worden (samen met de lokale wijziging).
 */
export async function enqueue(db: BeStrongDb, op: NewOp): Promise<void> {
  // Bewust zonder IndexedDB-cursors (first/orderBy/uniqueKeys): iOS Safari geeft daar soms
  // "UnknownError: Unable to open cursor". getAll-gebaseerde reads zijn betrouwbaar.
  const existing = (await db.outbox.toArray()).find((o) => o.key === op.key);
  const now = new Date().toISOString();
  if (existing && existing.seq !== undefined && existing.kind === op.kind) {
    const merged: OutboxOp =
      op.kind === 'upsert'
        ? { ...(existing as Extract<OutboxOp, { kind: 'upsert' }>), row: op.row, version: existing.version + 1, lastError: null }
        : { ...(existing as Extract<OutboxOp, { kind: 'rpc' }>), payload: op.payload, version: existing.version + 1, lastError: null };
    await db.outbox.put(merged);
    return;
  }
  const base = { key: op.key, version: 1, createdAt: now, attempts: 0, lastError: null };
  await db.outbox.add(op.kind === 'upsert' ? { ...base, kind: 'upsert', table: op.table, row: op.row } : { ...base, kind: 'rpc', fn: op.fn, payload: op.payload });
}

/** Verwijdert een verstuurde operatie, maar alleen als ze intussen niet opnieuw gewijzigd werd. */
export async function ack(db: BeStrongDb, op: OutboxOp): Promise<boolean> {
  return db.transaction('rw', db.outbox, async () => {
    const cur = await db.outbox.get(op.seq!);
    if (cur && cur.version === op.version) {
      await db.outbox.delete(op.seq!);
      return true;
    }
    return false;
  });
}

export async function pendingKeys(db: BeStrongDb): Promise<Set<string>> {
  return new Set((await db.outbox.toArray()).map((o) => o.key));
}
