import { Check, CloudOff, HardDrive, Loader2, TriangleAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSyncStatus } from '@/lib/sync/status';
import { useConflicts, useOutboxCount } from '@/lib/db/hooks';

/** Status: offline · lokaal opgeslagen · synchroniseren… · gesynchroniseerd · conflict/fout. */
export function useSyncLabel() {
  const s = useSyncStatus();
  const pending = useOutboxCount() ?? 0;
  const conflicts = useConflicts()?.length ?? 0;
  if (conflicts > 0) return { tone: 'danger', icon: TriangleAlert, text: `${conflicts} conflict${conflicts > 1 ? 'en' : ''}` } as const;
  if (!s.online || s.phase === 'offline')
    return { tone: 'warn', icon: CloudOff, text: pending ? `Offline · ${pending} lokaal opgeslagen` : 'Offline' } as const;
  if (s.phase === 'error') return { tone: 'danger', icon: TriangleAlert, text: 'Synchroniseren mislukt' } as const;
  if (s.phase === 'syncing') return { tone: 'muted', icon: Loader2, text: 'Synchroniseren…', spin: true } as const;
  if (pending > 0) return { tone: 'muted', icon: HardDrive, text: `${pending} lokaal opgeslagen` } as const;
  return { tone: 'ok', icon: Check, text: 'Gesynchroniseerd' } as const;
}

const toneClass = { ok: 'text-accent', muted: 'text-muted', warn: 'text-warn', danger: 'text-danger' } as const;

export function SyncIndicator({ compact = false }: { compact?: boolean }) {
  const l = useSyncLabel();
  const Icon = l.icon;
  return (
    <Link
      to="/settings/sync"
      className={`flex min-h-[36px] items-center gap-2 rounded-lg px-2 text-xs ${toneClass[l.tone]} hover:bg-surface md:justify-center lg:justify-start`}
      aria-label={`Syncstatus: ${l.text}`}
    >
      <Icon size={14} className={'spin' in l && l.spin ? 'animate-spin' : ''} />
      <span className={compact ? 'sr-only' : 'md:hidden lg:inline'}>{l.text}</span>
    </Link>
  );
}
