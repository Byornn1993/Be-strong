import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/Logo';
import { useAuth } from './AuthProvider';

export default function LoginPage() {
  const { session } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'password' | 'magic'>('password');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (session) return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'password') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else {
        // shouldCreateUser: false → een magic link maakt nooit een nieuw account aan.
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: { shouldCreateUser: false, emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
        });
        if (error) throw error;
        setSent(true);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(/invalid login/i.test(msg) ? 'E-mail of wachtwoord klopt niet.' : !navigator.onLine ? 'Je bent offline. Inloggen vraagt een verbinding.' : msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center px-5" style={{ paddingTop: 'var(--safe-top)', paddingBottom: 'var(--safe-bottom)' }}>
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size={64} />
          <h1 className="mt-4 text-3xl font-bold tracking-tight">
            Be <span className="text-accent">Strong</span>
          </h1>
          <p className="mt-1 text-muted">Stronger than yesterday.</p>
        </div>

        {!supabase ? (
          <div className="card p-4 text-sm text-muted">
            Supabase is niet geconfigureerd. Kopieer <code>.env.example</code> naar <code>.env</code> en vul de URL en publishable key in.
          </div>
        ) : sent ? (
          <div className="card p-5 text-center">
            <Mail className="mx-auto text-accent" />
            <p className="mt-2 font-semibold">Check je mailbox</p>
            <p className="mt-1 text-sm text-muted">We stuurden een inloglink naar {email}.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="card space-y-3 p-4">
            <label className="block">
              <span className="label">E-mail</span>
              <input className="field mt-1" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            {mode === 'password' && (
              <label className="block">
                <span className="label">Wachtwoord</span>
                <input className="field mt-1" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </label>
            )}
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
            <Button type="submit" variant="primary" size="lg" block loading={busy}>
              {mode === 'password' ? 'Inloggen' : 'Stuur inloglink'}
            </Button>
            <button type="button" className="tap w-full text-sm text-muted hover:text-text" onClick={() => setMode(mode === 'password' ? 'magic' : 'password')}>
              {mode === 'password' ? 'Liever een inloglink per e-mail' : 'Inloggen met wachtwoord'}
            </button>
          </form>
        )}
        <p className="mt-6 text-center text-xs text-faint">Privé-app. Nieuwe accounts kunnen zich niet registreren.</p>
      </div>
    </div>
  );
}
