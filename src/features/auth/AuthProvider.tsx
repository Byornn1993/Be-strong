import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AUTH_STORAGE_KEY, supabase } from '@/lib/supabase/client';
import { supabaseRemote } from '@/lib/supabase/remote';
import { closeDb, openDb } from '@/lib/db/schema';
import { setSessionUser } from '@/lib/db/session';
import { startSync } from '@/lib/sync/scheduler';

interface AuthState {
  session: Session | null;
  /** true zolang de opgeslagen sessie nog gelezen wordt. */
  loading: boolean;
  /** true zodra de lokale database van deze gebruiker open is. */
  ready: boolean;
  /** Foutmelding als de lokale database op dit toestel niet wil openen (bv. iOS-opslagfout). */
  dbError: string | null;
}

const AuthContext = createContext<AuthState>({ session: null, loading: true, ready: false, dbError: null });

/**
 * De opgeslagen sessie meteen lezen. supabase.auth.getSession() wacht bij een verlopen token op het
 * vernieuwen via het netwerk; op een trage gsm-verbinding (of na "Herladen") bleef de app daardoor
 * seconden op "laden" hangen. Local-first: met de opgeslagen sessie opent de app meteen, het
 * vernieuwen gebeurt op de achtergrond.
 */
function storedSession(): Session | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    return s?.user?.id ? s : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => (supabase ? storedSession() : null));
  const [loading, setLoading] = useState(() => !session);
  const [readyFor, setReadyFor] = useState<string | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    // Kan het token niet vernieuwd worden door een netwerkfout (offline, slecht bereik), dan blijft de
    // opgeslagen sessie gelden: lokaal verder werken, later synchroniseren. Is de login echt ongeldig,
    // dan meldt Supabase SIGNED_OUT via onAuthStateChange.
    supabase.auth.getSession().then(({ data, error }) => {
      if (data.session || !error) setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (s || event === 'SIGNED_OUT') setSession(s);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  // Lokale database + sync alleen met een sessie. Zonder sessie wordt er geen data geladen.
  useEffect(() => {
    if (!userId || !supabase) {
      setSessionUser(null);
      closeDb();
      setReadyFor(null);
      return;
    }
    setSessionUser(userId);
    const db = openDb(userId);
    let stop: (() => void) | null = null;
    let cancelled = false;
    setDbError(null);
    db.open().then(
      () => {
        if (cancelled) return;
        setReadyFor(userId);
        stop = startSync(db, supabaseRemote(supabase!));
      },
      (e: unknown) => {
        if (cancelled) return;
        console.error('Lokale database openen mislukt', e);
        setDbError(e instanceof Error ? `${e.name}: ${e.message}` : String(e));
      },
    );
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [userId]);

  return <AuthContext.Provider value={{ session, loading, ready: !!userId && readyFor === userId, dbError }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
