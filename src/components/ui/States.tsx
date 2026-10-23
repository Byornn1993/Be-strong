import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';

export function Spinner({ label = 'Laden…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 p-10 text-sm text-muted" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" aria-hidden />
      {label}
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {icon && <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-accent">{icon}</div>}
      <p className="text-base font-semibold">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="m-4 rounded-card border border-danger/30 bg-danger/10 p-4 text-sm">
      <div className="flex items-center gap-2 font-semibold text-danger">
        <AlertTriangle size={18} /> Er ging iets mis
      </div>
      <p className="mt-1 break-words text-muted">{error instanceof Error ? error.message : String(error)}</p>
      {onRetry && (
        <Button size="sm" className="mt-3" onClick={onRetry}>
          Opnieuw proberen
        </Button>
      )}
    </div>
  );
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state = { error: null as unknown };
  static getDerivedStateFromError(error: unknown) {
    return { error };
  }
  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }
  render() {
    if (this.state.error) return <ErrorState error={this.state.error} onRetry={() => this.setState({ error: null })} />;
    return this.props.children;
  }
}
