import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
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
}

const AuthContext = createContext<AuthState>({ session: null, loading: true, ready: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [readyFor, setReadyFor] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    // getSession werkt ook offline: de sessie staat lokaal. Zo opent de app zonder netwerk.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
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
    db.open().then(() => {
      if (cancelled) return;
      setReadyFor(userId);
      stop = startSync(db, supabaseRemote(supabase!));
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [userId]);

  return <AuthContext.Provider value={{ session, loading, ready: !!userId && readyFor === userId }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
