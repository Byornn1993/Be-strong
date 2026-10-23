import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/Logo';
import { useAuth } from './AuthProvider';

type Mode = 'password' | 'magic' | 'reset';

/** Volledig adres van een pagina binnen de app (werkt lokaal én onder /Be-strong/ op GitHub Pages). */
export const appUrl = (path = '') => window.location.origin + import.meta.env.BASE_URL + path;

export function AuthScreen({ children }: { children: React.ReactNode }) {
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
        {children}
        <p className="mt-6 text-center text-xs text-faint">Privé-app. Nieuwe accounts kunnen zich niet registreren.</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { session } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<Mode>('password');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<null | 'magic' | 'reset'>(null);

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
      } else if (mode === 'magic') {
        // shouldCreateUser: false → een magic link maakt nooit een nieuw account aan.
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: { shouldCreateUser: false, emailRedirectTo: appUrl() },
        });
        if (error) throw error;
        setSent('magic');
      } else {
        // De link in de mail opent /nieuw-wachtwoord, waar je een nieuw wachtwoord kiest.
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: appUrl('nieuw-wachtwoord') });
        if (error) throw error;
        setSent('reset');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(
        /invalid login/i.test(msg)
          ? 'E-mail of wachtwoord klopt niet.'
          : /rate limit|too many/i.test(msg)
            ? 'Te veel pogingen. Wacht even en probeer opnieuw.'
            : !navigator.onLine
              ? 'Je bent offline. Inloggen vraagt een verbinding.'
              : msg,
      );
    } finally {
      setBusy(false);
    }
  };

  if (!supabase)
    return (
      <AuthScreen>
        <div className="card p-4 text-sm text-muted">
          Supabase is niet geconfigureerd. Kopieer <code>.env.example</code> naar <code>.env</code> en vul de URL en publishable key in.
        </div>
      </AuthScreen>
    );

  if (sent)
    return (
      <AuthScreen>
        <div className="card p-5 text-center">
          <Mail className="mx-auto text-accent" />
          <p className="mt-2 font-semibold">Check je mailbox</p>
          <p className="mt-1 text-sm text-muted">
            {sent === 'reset'
              ? `We stuurden een link naar ${email.trim()} om een nieuw wachtwoord in te stellen. Kijk ook bij spam.`
              : `We stuurden een inloglink naar ${email.trim()}.`}
          </p>
          <button type="button" className="tap mt-3 text-sm text-muted hover:text-text" onClick={() => (setSent(null), setMode('password'))}>
            Terug naar inloggen
          </button>
        </div>
      </AuthScreen>
    );

  return (
    <AuthScreen>
      <form onSubmit={submit} className="card space-y-3 p-4">
        {mode === 'reset' && (
          <p className="text-sm text-muted">Vul je e-mailadres in. Je krijgt een link om een nieuw wachtwoord te kiezen.</p>
        )}
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
            {mode === 'password' && /klopt niet/.test(error) && (
              <span className="mt-1 block text-xs text-muted">Tip: je browser kan het wachtwoord van Bjorn Finance invullen (zelfde adres). Typ het Be Strong-wachtwoord zelf.</span>
            )}
          </p>
        )}
        <Button type="submit" variant="primary" size="lg" block loading={busy}>
          {mode === 'password' ? 'Inloggen' : mode === 'magic' ? 'Stuur inloglink' : 'Stuur resetlink'}
        </Button>
        {mode === 'password' ? (
          <div className="flex flex-col">
            <button type="button" className="tap w-full text-sm text-accent hover:underline" onClick={() => (setMode('reset'), setError(null))}>
              Wachtwoord vergeten?
            </button>
            <button type="button" className="tap w-full text-sm text-muted hover:text-text" onClick={() => (setMode('magic'), setError(null))}>
              Liever een inloglink per e-mail
            </button>
          </div>
        ) : (
          <button type="button" className="tap w-full text-sm text-muted hover:text-text" onClick={() => (setMode('password'), setError(null))}>
            Terug naar inloggen met wachtwoord
          </button>
        )}
      </form>
    </AuthScreen>
  );
}
