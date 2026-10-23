// Outbox-wachtrij: elke lokale wijziging wordt hier eerst bewaard en daarna naar Supabase gestuurd.

export type SimpleTable =
  | 'exercises'
  | 'exercise_prefs'
  | 'measurement_types'
  | 'body_measurements'
  | 'goals'
  | 'dashboard_widgets'
  | 'profiles';

export type RpcName = 'upsert_workout' | 'upsert_template' | 'import_workouts';

interface OpBase {
  seq?: number;
  /** Entiteitsleutel, bv. "workouts:<uuid>". Opeenvolgende wijzigingen aan dezelfde entiteit worden samengevoegd. */
  key: string;
  /** Verhoogt bij elke samenvoeging; voorkomt dat een wijziging tijdens het versturen verloren gaat. */
  version: number;
  createdAt: string;
  attempts: number;
  lastError: string | null;
}

export interface UpsertOp extends OpBase {
  kind: 'upsert';
  table: SimpleTable;
  row: Record<string, unknown>;
}

export interface RpcOp extends OpBase {
  kind: 'rpc';
  fn: RpcName;
  payload: Record<string, unknown>;
}

export type OutboxOp = UpsertOp | RpcOp;

/** Lokale tabel waar een entiteitsleutel naar verwijst. */
export type LocalTable =
  | 'exercises'
  | 'exercisePrefs'
  | 'templates'
  | 'workouts'
  | 'measurementTypes'
  | 'measurements'
  | 'goals'
  | 'widgets'
  | 'profile';

export interface Conflict {
  key: string;
  table: LocalTable;
  entityId: string;
  /** Lokale (nog niet verstuurde) versie. */
  local: unknown;
  /** Nieuwere versie op de server. */
  remote: unknown;
  localBase: string | null;
  remoteUpdatedAt: string;
  detectedAt: string;
}

export const entityKey = (table: LocalTable, id: string) => `${table}:${id}`;
