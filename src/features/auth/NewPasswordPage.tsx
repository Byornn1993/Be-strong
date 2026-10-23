import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/States';
import { AuthScreen } from './LoginPage';
import { useAuth } from './AuthProvider';

/**
 * Landingspagina van de "Wachtwoord vergeten"-mail. Supabase zet via de link een tijdelijke sessie
 * (detectSessionInUrl); hier kies je daarna een nieuw wachtwoord.
 */
export default function NewPasswordPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waited, setWaited] = useState(false);

  // De sessie uit de link kan een fractie later binnenkomen dan de eerste render.
  useEffect(() => {
    const t = setTimeout(() => setWaited(true), 4000);
    return () => clearTimeout(t);
  }, []);

  const linkError = new URLSearchParams(window.location.hash.slice(1)).get('error_description');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pw.length < 10) return setError('Gebruik minstens 10 tekens.');
    if (pw !== pw2) return setError('De wachtwoorden zijn niet gelijk.');
    setBusy(true);
    setError(null);
    const { error } = (await supabase?.auth.updateUser({ password: pw })) ?? { error: new Error('Niet verbonden') };
    setBusy(false);
    if (error) return setError(error.message);
    navigate('/', { replace: true });
  };

  if (loading || (!session && !waited && !linkError)) return <Spinner label="Link controleren…" />;

  if (!session)
    return (
      <AuthScreen>
        <div className="card space-y-3 p-4 text-sm">
          <p className="font-semibold">Deze link werkt niet (meer)</p>
          <p className="text-muted">{linkError ?? 'De link is verlopen of al gebruikt.'} Vraag een nieuwe aan via “Wachtwoord vergeten?”.</p>
          <Button block onClick={() => navigate('/login', { replace: true })}>
            Naar inloggen
          </Button>
        </div>
      </AuthScreen>
    );

  return (
    <AuthScreen>
      <form onSubmit={submit} className="card space-y-3 p-4">
        <p className="font-semibold">Kies een nieuw wachtwoord</p>
        <p className="text-sm text-muted">Voor {session.user.email}. Gebruik een ander wachtwoord dan bij Bjorn Finance.</p>
        <input className="field" type="password" autoComplete="new-password" placeholder="Nieuw wachtwoord (min. 10 tekens)" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
        <input className="field" type="password" autoComplete="new-password" placeholder="Herhaal" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" size="lg" block loading={busy}>
          Wachtwoord opslaan
        </Button>
      </form>
    </AuthScreen>
  );
}
