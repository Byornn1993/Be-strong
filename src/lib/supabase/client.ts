import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Alleen de publieke URL en de publishable/anon key. Nooit een service-role/secret key in de frontend.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const supabaseConfigured = Boolean(url && key);

export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(url!, key!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'bestrong-auth' },
    })
  : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new Error('Supabase is niet geconfigureerd (zie .env.example).');
  return supabase;
}
