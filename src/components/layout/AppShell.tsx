import { Suspense, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Dumbbell, History, Plus, Ruler, Settings, User } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { ErrorBoundary, Spinner } from '@/components/ui/States';
import { ActiveWorkoutBar } from './ActiveWorkoutBar';
import { SyncIndicator } from './SyncIndicator';
import { useSyncStatus } from '@/lib/sync/status';
import { useActiveWorkout } from '@/features/workout/WorkoutProvider';
import { ActiveWorkoutSheet } from '@/features/workout/ActiveWorkoutSheet';

const NAV = [
  { to: '/profile', label: 'Profiel', icon: User },
  { to: '/history', label: 'Geschiedenis', icon: History },
  { to: '/workout', label: 'Start', icon: Plus, primary: true },
  { to: '/exercises', label: 'Oefeningen', icon: Dumbbell },
  { to: '/measure', label: 'Metingen', icon: Ruler },
] as const;

function NavItem({ to, label, icon: Icon, primary, variant }: { to: string; label: string; icon: typeof User; primary?: boolean; variant: 'bottom' | 'side' }) {
  if (variant === 'bottom') {
    return (
      <NavLink
        to={to}
        className={({ isActive }) => `flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium ${isActive ? 'text-accent' : 'text-muted'}`}
      >
        {({ isActive }) =>
          primary ? (
            <>
              <span className={`flex h-9 w-12 items-center justify-center rounded-xl ${isActive ? 'bg-accent text-accent-ink' : 'bg-primary text-accent'}`}>
                <Icon size={22} strokeWidth={2.5} />
              </span>
              {label}
            </>
          ) : (
            <>
              <Icon size={22} />
              {label}
            </>
          )
        }
      </NavLink>
    );
  }
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-medium transition md:flex-col md:justify-center md:gap-1 md:px-1 md:py-2 md:text-[11px] lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-sm ${
          primary
            ? isActive
              ? 'bg-accent text-accent-ink'
              : 'bg-primary text-accent hover:brightness-110'
            : isActive
              ? 'bg-surface-2 text-text'
              : 'text-muted hover:bg-surface hover:text-text'
        }`
      }
    >
      <Icon size={20} />
      <span>{primary ? 'Start workout' : label}</span>
    </NavLink>
  );
}

export function AppShell({ children }: { children?: ReactNode }) {
  const { active, sheetOpen } = useActiveWorkout();
  const location = useLocation();
  const sync = useSyncStatus();

  return (
    <div className="min-h-dvh md:flex" style={{ paddingLeft: 'var(--safe-left)', paddingRight: 'var(--safe-right)' }}>
      {/* Zijbalk: rail op tablet, volledige zijbalk op desktop */}
      <aside className="sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-bg px-2 py-4 md:flex md:w-[88px] lg:w-[240px] lg:px-4">
        <div className="mb-6 flex items-center gap-3 px-1 md:justify-center lg:justify-start">
          <Logo size={36} />
          <div className="hidden lg:block">
            <p className="font-bold leading-tight">
              Be <span className="text-accent">Strong</span>
            </p>
            <p className="text-[11px] text-muted">Stronger than yesterday.</p>
          </div>
        </div>
        <nav className="flex flex-col gap-1" aria-label="Hoofdnavigatie">
          {NAV.map((n) => (
            <NavItem key={n.to} {...n} variant="side" />
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-2">
          <SyncIndicator />
          <NavItem to="/settings" label="Instellingen" icon={Settings} variant="side" />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="md:hidden" style={{ paddingTop: 'var(--safe-top)' }} />
        {!sync.online && (
          <div className="flex justify-center border-b border-warn/20 bg-warn/10 md:hidden">
            <SyncIndicator />
          </div>
        )}
        <main
          className="mx-auto w-full max-w-6xl md:px-8 md:pb-10"
          style={{ paddingBottom: `calc(var(--nav-h) + var(--safe-bottom) + ${active ? '64px' : '16px'})` }}
        >
          <ErrorBoundary key={location.pathname}>
            <Suspense fallback={<Spinner />}>{children ?? <Outlet />}</Suspense>
          </ErrorBoundary>
        </main>
      </div>

      {active && !sheetOpen && <ActiveWorkoutBar />}

      {/* Onderste navigatie op mobiel */}
      <nav
        aria-label="Hoofdnavigatie"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-bg/95 backdrop-blur md:hidden"
        style={{ paddingBottom: 'var(--safe-bottom)', height: 'calc(var(--nav-h) + var(--safe-bottom))' }}
      >
        {NAV.map((n) => (
          <NavItem key={n.to} {...n} variant="bottom" />
        ))}
      </nav>

      <ActiveWorkoutSheet />
    </div>
  );
}
