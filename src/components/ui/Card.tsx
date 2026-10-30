import type { HTMLAttributes, ReactNode } from 'react';

export function Card({ className = '', children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`card ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, action, subtitle }: { title: ReactNode; action?: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 pt-4">
      <div className="min-w-0">
        <h3 className="truncate text-[15px] font-semibold">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/** KPI-tegel. `hero` = de belangrijkste tegel van het scherm: subtiel gouden accent, gouden label en waarde. */
export function Stat({ label, value, hint, hero }: { label: string; value: ReactNode; hint?: ReactNode; hero?: boolean }) {
  return (
    <div className={`card p-4 ${hero ? 'kpi-hero' : ''}`}>
      <p className={`label ${hero ? 'text-accent' : ''}`}>{label}</p>
      <p className={`num mt-1 text-2xl font-semibold ${hero ? 'text-accent' : 'text-text'}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}
