import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { IconButton } from './Button';

export function PageHeader({ title, back, actions, subtitle }: { title: ReactNode; back?: boolean | string; actions?: ReactNode; subtitle?: ReactNode }) {
  const navigate = useNavigate();
  return (
    <header className="flex items-center gap-1 px-4 pb-2 pt-4 md:px-0">
      {back && (
        <IconButton label="Terug" className="-ml-3" onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}>
          <ChevronLeft size={24} />
        </IconButton>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[26px] font-bold tracking-tight md:text-3xl">{title}</h1>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-1">{actions}</div>}
    </header>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: string }[] }) {
  return (
    <div role="tablist" className="flex gap-1 rounded-xl bg-surface p-1">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={`min-h-[40px] flex-1 rounded-lg px-3 text-sm font-medium transition ${value === t.value ? 'bg-surface-2 text-text shadow' : 'text-muted hover:text-text'}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-[36px] shrink-0 rounded-full border px-3 text-sm transition ${active ? 'border-accent/60 bg-primary-soft text-accent' : 'border-border text-muted hover:text-text'}`}
    >
      {children}
    </button>
  );
}
