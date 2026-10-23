import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatNumber } from '@/domain/format';

// Grafieken in rustig groen. Recharts wordt alleen in de pagina's met grafieken geladen (lazy routes).

const axis = { stroke: 'var(--faint)', fontSize: 11, tickLine: false, axisLine: false } as const;

const tooltipStyle = {
  contentStyle: { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)', fontSize: 12 },
  labelStyle: { color: 'var(--muted)' },
  cursor: { fill: 'rgba(63,224,143,0.06)', stroke: 'var(--border)' },
} as const;

export interface Point {
  label: string;
  value: number | null;
}

export function TrendChart({ data, unit = '', height = 200 }: { data: Point[]; unit?: string; height?: number }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
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
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={8} />
          <YAxis {...axis} allowDecimals={false} width={44} tickFormatter={(v: number) => formatNumber(v)} />
          <Tooltip {...tooltipStyle} formatter={(v: number) => [`${formatNumber(v)} ${unit}`.trim(), '']} separator="" />
          {goal !== undefined && <ReferenceLine y={goal} stroke="var(--accent)" strokeDasharray="4 4" label={{ value: `doel ${goal}`, fill: 'var(--accent)', fontSize: 11, position: 'insideTopRight' }} />}
          <Bar dataKey="value" fill="#1f7a58" radius={[6, 6, 0, 0]} maxBarSize={28} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
