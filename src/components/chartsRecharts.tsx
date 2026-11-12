import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatNumber } from '@/domain/format';
import type { Point } from './charts';

// Grafieken in de huisstijl: goud op een subtiel raster (--line-2).
// Niet rechtstreeks importeren: gebruik '@/components/charts' (laadt Recharts pas als er een grafiek getoond wordt).

const axis = { stroke: 'var(--muted)', fontSize: 11, tickLine: false, axisLine: false } as const;

const tooltipStyle = {
  contentStyle: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, color: 'var(--fg)', fontSize: 12 },
  labelStyle: { color: 'var(--muted)' },
  cursor: { fill: 'var(--accent-soft)', stroke: 'var(--line)' },
} as const;

export function TrendChart({ data, unit = '', height = 200 }: { data: Point[]; unit?: string; height?: number }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="var(--line-2)" vertical={false} />
          <XAxis dataKey="label" {...axis} minTickGap={24} />
          <YAxis {...axis} domain={['auto', 'auto']} width={44} tickFormatter={(v: number) => formatNumber(v)} />
          <Tooltip {...tooltipStyle} formatter={(v: number) => [`${formatNumber(v)} ${unit}`.trim(), '']} separator="" />
          <Line type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2.2} dot={{ r: 2.5, fill: 'var(--accent)' }} activeDot={{ r: 5 }} connectNulls isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BarsChart({ data, goal, unit = '', height = 180 }: { data: Point[]; goal?: number; unit?: string; height?: number }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="var(--line-2)" vertical={false} />
          <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={8} />
          <YAxis {...axis} allowDecimals={false} width={44} tickFormatter={(v: number) => formatNumber(v)} />
          <Tooltip {...tooltipStyle} formatter={(v: number) => [`${formatNumber(v)} ${unit}`.trim(), '']} separator="" />
          {goal !== undefined && <ReferenceLine y={goal} stroke="var(--champ)" strokeDasharray="4 4" label={{ value: `doel ${goal}`, fill: 'var(--champ)', fontSize: 11, position: 'insideTopRight' }} />}
          <Bar dataKey="value" fill="var(--accent)" radius={[6, 6, 0, 0]} maxBarSize={28} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Mini-lijn zonder assen (bv. op een metingkaart). */
export function Sparkline({ data, className = 'h-12 w-28' }: { data: Point[]; className?: string }) {
  return (
    <div className={className} aria-hidden>
      <ResponsiveContainer>
        <LineChart data={data}>
          <Line dataKey="value" stroke="var(--accent)" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
