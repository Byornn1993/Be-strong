import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Dumbbell, History, Plus, Ruler, Settings, User } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ErrorBoundary, Spinner } from '@/components/ui/States';
import { ActiveWorkoutBar } from './ActiveWorkoutBar';
import { SyncIndicator, useSyncLabel } from './SyncIndicator';
import { useWorkoutStatus } from '@/features/workout/WorkoutProvider';

// Het workoutscherm (met de sleepbibliotheek) zit niet in de opstartbundel: het laadt pas als er een workout
// loopt. Kort na het opstarten wordt het stilletjes vooraf opgehaald, zodat "Start" meteen opent.
const loadWorkoutSheet = () => import('@/features/workout/ActiveWorkoutSheet');
const ActiveWorkoutSheet = lazy(() => loadWorkoutSheet().then((m) => ({ default: m.ActiveWorkoutSheet })));

const NAV = [
  { to: '/profile', label: 'Profiel', icon: User },
  { to: '/history', label: 'Geschiedenis', icon: History },
  { to: '/workout', label: 'Start', icon: Plus, primary: true },
  { to: '/exercises', label: 'Oefeningen', icon: Dumbbell },
  { to: '/measure', label: 'Metingen', icon: Ruler },
] as const;

type Item = { to: string; label: string; icon: typeof User; primary?: boolean };

/** Onderste menu (mobiel): actief = witte tekst + gouden icoon. "Start" is een ronde gouden knop. */
function BottomItem({ to, label, icon: Icon, primary }: Item) {
  return (
    <NavLink to={to} className="flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0.5 text-[11.5px] font-medium">
      {({ isActive }) =>
        primary ? (
          <>
            <span className="-mt-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-ink shadow-gold">
              <Icon size={24} strokeWidth={2.4} />
            </span>
            <span className={isActive ? 'text-text' : 'text-muted'}>{label}</span>
          </>
        ) : (
          <>
            <Icon size={21} strokeWidth={2} className={isActive ? 'text-accent' : 'text-muted'} />
            <span className={isActive ? 'text-text' : 'text-muted'}>{label}</span>
          </>
        )
      }
    </NavLink>
  );
}

/** Zijbalk (desktop): actief = gouden zachte achtergrond, gouden streep links en gouden icoon. */
function SideItem({ to, label, icon: Icon, primary }: Item) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex min-h-[44px] items-center gap-3 rounded-sm2 px-3 text-sm font-medium transition-colors duration-150 ${
          isActive ? 'bg-primary text-text shadow-[inset_3px_0_0_var(--accent)]' : 'text-muted hover:bg-champ/[0.07] hover:text-text'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={19} strokeWidth={2} className={isActive || primary ? 'text-accent' : ''} />
          <span>{primary ? 'Start workout' : label}</span>
        </>
      )}
    </NavLink>
  );
}

export function AppShell({ children }: { children?: ReactNode }) {
  const { hasActive: active, sheetOpen } = useWorkoutStatus();
  const location = useLocation();

  useEffect(() => {
    const t = setTimeout(() => void loadWorkoutSheet(), 2500);
    return () => clearTimeout(t);
  }, []);
  // Op gsm is er geen zijbalk: offline, een sync-fout of een conflict tonen we bovenaan in een balk.
  const sync = useSyncLabel();
  const syncProblem = sync.tone === 'warn' || sync.tone === 'danger';

  return (
    <div className="min-h-dvh desk:flex" style={{ paddingLeft: 'var(--safe-left)', paddingRight: 'var(--safe-right)' }}>
      {/* Zijbalk vanaf 900px */}
      <aside className="sticky top-0 hidden h-dvh w-[240px] shrink-0 flex-col border-r border-card-line bg-side px-4 py-5 backdrop-blur-md desk:flex">
        <div className="mb-7 flex items-center gap-3 px-1">
          <Logo size={38} />
          <div>
            <p className="font-bold leading-tight tracking-tight">Be Strong</p>
            <p className="text-[11.5px] text-muted">Stronger than yesterday.</p>
          </div>
        </div>
        <nav className="flex flex-col gap-1" aria-label="Hoofdnavigatie">
          {NAV.map((n) => (
            <SideItem key={n.to} {...n} />
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-1">
          <SyncIndicator />
          <ThemeToggle />
          <SideItem to="/settings" label="Instellingen" icon={Settings} />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="desk:hidden" style={{ paddingTop: 'var(--safe-top)' }} />
        {syncProblem && (
          <div className={`flex justify-center border-b desk:hidden ${sync.tone === 'danger' ? 'border-danger/20 bg-danger/10' : 'border-warn/20 bg-warn/10'}`}>
            <SyncIndicator />
          </div>
        )}
        <main
          className="mx-auto w-full max-w-6xl desk:px-8"
          style={{ paddingBottom: `calc(var(--nav-h) + var(--safe-bottom) + ${active ? '64px' : '16px'})` }}
        >
          <ErrorBoundary key={location.pathname}>
            <Suspense fallback={<Spinner />}>{children ?? <Outlet />}</Suspense>
          </ErrorBoundary>
        </main>
      </div>

      {active && !sheetOpen && <ActiveWorkoutBar />}

      {/* Onderste menu onder 900px */}
      <nav
        aria-label="Hoofdnavigatie"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-card-line bg-bg desk:hidden"
        style={{ paddingBottom: 'var(--safe-bottom)', height: 'calc(var(--nav-h) + var(--safe-bottom))' }}
      >
        {NAV.map((n) => (
          <BottomItem key={n.to} {...n} />
        ))}
      </nav>

      {active && (
        <Suspense fallback={null}>
          <ActiveWorkoutSheet />
        </Suspense>
      )}
    </div>
  );
}
