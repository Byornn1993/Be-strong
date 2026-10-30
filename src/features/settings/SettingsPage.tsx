import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Bell, ChevronRight, Download, FileUp, KeyRound, LayoutTemplate, LogOut, RefreshCw, Target } from 'lucide-react';
import Dexie from 'dexie';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/States';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { SyncIndicator } from '@/components/layout/SyncIndicator';
import { ThemeToggle } from '@/components/ThemeToggle';
import { InstallCard } from '@/components/InstallCard';
import { useExercises, useOutboxCount, useProfile } from '@/lib/db/hooks';
import { saveProfile, saveTemplate } from '@/lib/db/repo';
import { closeDb, getDb } from '@/lib/db/schema';
import { requireUserId } from '@/lib/db/session';
import { flushSync } from '@/lib/sync/scheduler';
import type { Profile } from '@/lib/db/types';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/features/auth/AuthProvider';
import { requestNotificationPermission } from '@/features/workout/alerts';
import { buildSeedTemplates } from './seedTemplates';

function Row({ to, icon, label, hint }: { to: string; icon: React.ReactNode; label: string; hint?: string }) {
  return (
    <Link to={to} className="flex min-h-[56px] items-center gap-3 px-4 py-2 hover:bg-surface-2">
      <span className="text-accent">{icon}</span>
      <span className="flex-1">
        <span className="block text-[15px]">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <ChevronRight size={18} className="text-faint" />
    </Link>
  );
}

export default function SettingsPage() {
  const { session } = useAuth();
  const profile = useProfile();
  const library = useExercises();
  const pending = useOutboxCount() ?? 0;
  const { confirm, dialog } = useConfirm();
  const [seedMsg, setSeedMsg] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [notif, setNotif] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');

  if (!profile || !library) return <Spinner />;

  const importSeed = async () => {
    setSeeding(true);
    setSeedMsg(null);
    try {
      // Eerst synchroniseren, zodat we nooit een template overschrijven die al op de server bestaat.
      if (navigator.onLine) await flushSync().catch(() => {});
      const { templates, missing } = buildSeedTemplates(requireUserId(), library);
      let added = 0;
      for (const t of templates) {
        if (await getDb().templates.get(t.id)) continue;
        await saveTemplate(t);
        added++;
      }
      setSeedMsg(
        `${added} template${added === 1 ? '' : 's'} toegevoegd, ${templates.length - added} bestond${templates.length - added === 1 ? '' : 'en'} al.` +
          (missing.length ? ` Niet gevonden: ${missing.join(', ')}.` : ''),
      );
    } catch (e) {
      setSeedMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setSeeding(false);
    }
  };

  const exportBackup = async () => {
    const db = getDb();
    const data = {
      app: 'Be Strong',
      versie: 1,
      geexporteerd: new Date().toISOString(),
      workouts: await db.workouts.toArray(),
      templates: await db.templates.toArray(),
      exercises: (await db.exercises.toArray()).filter((e) => e.userId),
      exercisePrefs: await db.exercisePrefs.toArray(),
      measurementTypes: (await db.measurementTypes.toArray()).filter((t) => t.userId),
      measurements: await db.measurements.toArray(),
      goals: await db.goals.toArray(),
      widgets: await db.widgets.toArray(),
      profile: await db.profile.toArray(),
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `be-strong-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const logout = async () => {
    if (pending > 0) {
      await flushSync().catch(() => {});
    }
    const left = await getDb().outbox.count();
    if (left > 0 && !(await confirm({ title: 'Niet alles is gesynchroniseerd', message: `${left} wijziging(en) staan nog lokaal. Ze blijven op dit toestel bewaard en worden verstuurd bij de volgende login.`, confirmLabel: 'Toch uitloggen', danger: true })))
      return;
    await supabase?.auth.signOut();
  };

  const wipeLocal = async () => {
    if (!(await confirm({ title: 'Lokale kopie wissen?', message: 'Alle gegevens op DIT toestel worden gewist (niet op de server). Niet-gesynchroniseerde wijzigingen gaan verloren.', confirmLabel: 'Wissen en uitloggen', danger: true }))) return;
    const name = getDb().name;
    closeDb();
    await Dexie.delete(name);
    await supabase?.auth.signOut();
  };

  return (
    <div>
      <PageHeader title="Instellingen" back="/profile" />
      <div className="grid gap-4 px-4 md:grid-cols-2 desk:px-0">
        <Card className="space-y-3 p-4">
          <p className="font-semibold">Profiel</p>
          <ProfileForm key={profile.serverUpdatedAt ?? 'local'} profile={profile} />
          <p className="text-xs text-muted">Ingelogd als {session?.user.email}</p>
        </Card>

        <Card className="divide-y divide-border overflow-hidden">
          <Row to="/settings/sync" icon={<RefreshCw size={20} />} label="Synchronisatie" hint={pending ? `${pending} wijziging(en) wachten` : 'Status en conflicten'} />
          <Row to="/settings/import" icon={<FileUp size={20} />} label="Importeer uit Strong (CSV)" hint="Je volledige workoutgeschiedenis" />
          <Row to="/goals" icon={<Target size={20} />} label="Doelen" />
          <div className="px-4 py-3">
            <SyncIndicator />
          </div>
        </Card>

        <Card className="space-y-3 p-4">
          <p className="flex items-center gap-2 font-semibold">
            <LayoutTemplate size={18} className="text-accent" /> Standaardtemplates
          </p>
          <p className="text-sm text-muted">Upper, Only Upper 1 & 2, Lower Dag 1 & 2 en Armdag. Veilig om opnieuw te doen: er komen geen dubbels en je eigen aanpassingen blijven.</p>
          <Button onClick={importSeed} loading={seeding}>
            Importeer standaardtemplates
          </Button>
          {seedMsg && <p className="text-sm text-accent">{seedMsg}</p>}
        </Card>

        <Card className="space-y-3 p-4">
          <p className="flex items-center gap-2 font-semibold">
            <Bell size={18} className="text-accent" /> Rusttimer-meldingen
          </p>
          <p className="text-sm text-muted">
            Geluid en trillen werken in de app. Een melding wanneer de app op de achtergrond staat werkt alleen waar je browser dat toelaat (op iPhone enkel als geïnstalleerde app, iOS 16.4+), en is niet gegarandeerd.
          </p>
          {notif === 'unsupported' ? (
            <p className="text-sm text-faint">Niet ondersteund in deze browser.</p>
          ) : notif === 'granted' ? (
            <p className="text-sm text-accent">Meldingen staan aan.</p>
          ) : (
            <Button onClick={async () => setNotif(await requestNotificationPermission())}>Meldingen toestaan</Button>
          )}
        </Card>

        <InstallCard />

        <PasswordCard />

        <Card className="space-y-2 p-4">
          <p className="font-semibold">Gegevens en account</p>
          <ThemeToggle className="-mx-1 border border-line" />
          <Button block icon={<Download size={16} />} onClick={exportBackup}>
            Back-up exporteren (JSON)
          </Button>
          <p className="text-xs text-muted">Bewaar het bestand veilig, nooit op GitHub.</p>
          <Button block variant="secondary" icon={<LogOut size={16} />} onClick={logout}>
            Uitloggen
          </Button>
          <Button block variant="danger" onClick={wipeLocal}>
            Lokale kopie wissen en uitloggen
          </Button>
        </Card>
      </div>
      <p className="px-4 py-6 text-center text-xs text-faint">Be Strong · v{__APP_VERSION__}</p>
      {dialog}
    </div>
  );
}

function ProfileForm({ profile }: { profile: Profile }) {
  const [name, setName] = useState(profile.displayName ?? '');
  const [avatar, setAvatar] = useState(profile.avatarUrl ?? '');
  const [rest, setRest] = useState(String(profile.defaultRestSec));
  const [saved, setSaved] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const r = Math.min(1800, Math.max(0, Number(rest) || 0));
    const url = avatar.trim();
    await saveProfile({ ...profile, displayName: name.trim() || null, avatarUrl: url && /^https:\/\//.test(url) ? url : null, defaultRestSec: r });
    setSaved(true);
  };
  return (
    <form onSubmit={submit} className="space-y-3" onChange={() => setSaved(false)}>
      <label className="block">
        <span className="label">Naam</span>
        <input className="field mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Bjorn Wevers" />
      </label>
      <label className="block">
        <span className="label">Profielfoto (https-URL, optioneel)</span>
        <input className="field mt-1" value={avatar} onChange={(e) => setAvatar(e.target.value)} inputMode="url" />
      </label>
      <label className="block">
        <span className="label">Standaard rusttijd (seconden)</span>
        <input className="field mt-1" inputMode="numeric" value={rest} onChange={(e) => setRest(e.target.value.replace(/\D/g, ''))} />
      </label>
      <Button type="submit" variant="primary">
        {saved ? 'Bewaard ✓' : 'Bewaren'}
      </Button>
    </form>
  );
}

function PasswordCard() {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pw.length < 10) return setMsg({ ok: false, text: 'Gebruik minstens 10 tekens.' });
    if (pw !== pw2) return setMsg({ ok: false, text: 'De wachtwoorden zijn niet gelijk.' });
    setBusy(true);
    const { error } = (await supabase?.auth.updateUser({ password: pw })) ?? { error: new Error('Niet verbonden') };
    setBusy(false);
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: 'Wachtwoord gewijzigd.' });
    if (!error) {
      setPw('');
      setPw2('');
    }
  };
  return (
    <Card className="p-4">
      <form onSubmit={submit} className="space-y-3">
        <p className="flex items-center gap-2 font-semibold">
          <KeyRound size={18} className="text-accent" /> Wachtwoord wijzigen
        </p>
        <input className="field" type="password" autoComplete="new-password" placeholder="Nieuw wachtwoord" value={pw} onChange={(e) => setPw(e.target.value)} />
        <input className="field" type="password" autoComplete="new-password" placeholder="Herhaal" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        {msg && <p className={`text-sm ${msg.ok ? 'text-accent' : 'text-danger'}`}>{msg.text}</p>}
        <Button type="submit" loading={busy}>
          Wijzigen
        </Button>
      </form>
    </Card>
  );
}
