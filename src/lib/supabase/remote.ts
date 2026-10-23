import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { RemoteError, type RemoteApi } from '@/lib/sync/engine';
import type { RpcName, SimpleTable } from '@/lib/sync/types';

// Supabase-implementatie van de RemoteApi die de sync-engine gebruikt.
// Netwerkfouten (offline, time-out) worden apart gemarkeerd: die worden later gewoon opnieuw geprobeerd.

function toError(e: PostgrestError | Error | null | unknown): RemoteError {
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (e && typeof e === 'object' && 'code' in e && (e as PostgrestError).code) {
    const pe = e as PostgrestError;
    return new RemoteError(`${pe.message}${pe.details ? ` (${pe.details})` : ''}`, offline);
  }
  const msg = e instanceof Error ? e.message : e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e);
  const network = offline || /fetch|network|timeout|load failed/i.test(msg);
  return new RemoteError(msg, network);
}

export function supabaseRemote(client: SupabaseClient): RemoteApi {
  return {
    async upsert(table: SimpleTable, row) {
      const { data, error } = await client.from(table).upsert(row, { onConflict: 'id' }).select('updated_at').single();
      if (error) throw toError(error);
      return (data as { updated_at: string }).updated_at;
    },
    async rpc(fn: RpcName, payload) {
      const { data, error } = await client.rpc(fn, { p: payload });
      if (error) throw toError(error);
      return data as unknown;
    },
    async fetchSince(table, select, since, from, to) {
      let q = client.from(table).select(select).order('updated_at', { ascending: true }).order('id').range(from, to);
      if (since) q = q.gt('updated_at', since);
      const { data, error } = await q;
      if (error) throw toError(error);
      return (data ?? []) as unknown[];
    },
  };
}
