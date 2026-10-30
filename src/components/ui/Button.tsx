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
  // Primair: goud met donkere tekst; bij hover iets lichter.
  primary: 'bg-accent text-accent-ink font-semibold hover:bg-[color-mix(in_srgb,var(--accent)_86%,var(--fg))]',
  // Gewone knop: rand --line, bij hover een gouden rand.
  secondary: 'bg-transparent text-text border border-line hover:border-accent',
  // Ghost: zonder rand.
  ghost: 'bg-transparent text-text hover:bg-champ/[0.07]',
  danger: 'bg-transparent text-danger border border-danger/40 hover:border-danger hover:bg-danger/10',
};

const sizes: Record<Size, string> = {
  sm: 'min-h-[36px] px-3 text-sm rounded-sm2',
  md: 'min-h-[44px] px-4 text-[15px] rounded-[12px]',
  lg: 'min-h-[48px] px-5 text-base rounded-[12px]',
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
      className={`inline-flex items-center justify-center gap-2 transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${block ? 'w-full' : ''} ${className}`}
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
      className={`tap inline-flex items-center justify-center rounded-sm2 text-muted transition-colors duration-150 hover:bg-champ/[0.07] hover:text-text disabled:opacity-40 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
