import { lazy, Suspense, type ComponentProps } from 'react';

// Grafieken laden "lui": Recharts (±100 kB gzip) komt pas binnen als er echt een grafiek op het scherm staat.
// Zo verschijnt bv. de Profielpagina meteen; de grafiek volgt een fractie later in een vak van dezelfde hoogte.

export interface Point {
  label: string;
  value: number | null;
}

const LazyTrend = lazy(() => import('./chartsRecharts').then((m) => ({ default: m.TrendChart })));
const LazyBars = lazy(() => import('./chartsRecharts').then((m) => ({ default: m.BarsChart })));

type TrendProps = ComponentProps<typeof LazyTrend>;
type BarsProps = ComponentProps<typeof LazyBars>;

const Placeholder = ({ height }: { height: number }) => <div style={{ height }} className="w-full animate-pulse rounded-lg bg-surface-2/60" aria-hidden />;

export function TrendChart(props: TrendProps) {
  return (
    <Suspense fallback={<Placeholder height={props.height ?? 200} />}>
      <LazyTrend {...props} />
    </Suspense>
  );
}

export function BarsChart(props: BarsProps) {
  return (
    <Suspense fallback={<Placeholder height={props.height ?? 180} />}>
      <LazyBars {...props} />
    </Suspense>
  );
}

const LazySpark = lazy(() => import('./chartsRecharts').then((m) => ({ default: m.Sparkline })));

export function Sparkline(props: ComponentProps<typeof LazySpark>) {
  return (
    <Suspense fallback={<div className={props.className ?? 'h-12 w-28'} aria-hidden />}>
      <LazySpark {...props} />
    </Suspense>
  );
}
