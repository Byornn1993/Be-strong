import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg' | 'sm';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  block?: boolean;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:brightness-105 active:brightness-95 font-semibold',
  secondary: 'bg-surface-2 text-text border border-border hover:bg-[#1f2724]',
  ghost: 'bg-transparent text-text hover:bg-surface-2',
  danger: 'bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25',
};

const sizes: Record<Size, string> = {
  sm: 'min-h-[36px] px-3 text-sm rounded-lg',
  md: 'min-h-[44px] px-4 text-[15px] rounded-xl',
  lg: 'min-h-[52px] px-5 text-base rounded-xl',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, block, loading, className = '', children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${block ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden /> : icon}
      {children}
    </button>
  );
});

export function IconButton({ label, className = '', children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`tap inline-flex items-center justify-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-text disabled:opacity-40 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
