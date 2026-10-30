import { forwardRef, useEffect, useState, type InputHTMLAttributes } from 'react';

interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: number | null;
  onValue: (v: number | null) => void;
  /** Gehele getallen (reps) of decimalen (kg). */
  integer?: boolean;
}

const parse = (s: string, integer: boolean): number | null => {
  const t = s.replace(',', '.').trim();
  if (t === '') return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return integer ? Math.round(n) : Math.round(n * 100) / 100;
};

const show = (v: number | null) => (v === null ? '' : String(v).replace('.', ','));

/** Numeriek veld met decimaal toetsenbord op iPhone. Accepteert komma én punt. */
export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
  { value, onValue, integer = false, className = '', ...rest },
  ref,
) {
  const [text, setText] = useState(show(value));

  // Externe wijziging (bv. Previous overnemen) → tekst bijwerken, behalve tijdens het typen van "24,".
  useEffect(() => {
    if (parse(text, integer) !== value) setText(show(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      ref={ref}
      type="text"
      inputMode={integer ? 'numeric' : 'decimal'}
      pattern={integer ? '[0-9]*' : '[0-9]*[.,]?[0-9]*'}
      autoComplete="off"
      enterKeyHint="next"
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        if (!/^\d*[.,]?\d*$/.test(raw)) return;
        setText(raw);
        onValue(parse(raw, integer));
      }}
      onFocus={(e) => e.target.select()}
      className={`h-10 w-full rounded-sm2 border border-line bg-input px-2 text-center font-semibold tabular-nums text-text placeholder:font-normal placeholder:text-faint focus:border-accent focus:outline-none ${className}`}
      {...rest}
    />
  );
});

/** Tijd-invoer als mm:ss (of seconden). */
export function DurationInput({ value, onValue, className = '', ...rest }: Omit<NumberInputProps, 'integer'>) {
  const fmt = (v: number | null) => (v === null ? '' : `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`);
  const [text, setText] = useState(fmt(value));
  useEffect(() => {
    setText(fmt(value));
  }, [value]);
  const commit = (s: string) => {
    const t = s.trim();
    if (!t) return onValue(null);
    const m = /^(\d+)(?:[:.,](\d{1,2}))?$/.exec(t);
    if (!m) return setText(fmt(value));
    const sec = m[2] !== undefined ? Number(m[1]) * 60 + Number(m[2]) : Number(m[1]);
    onValue(sec);
  };
  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={(e) => commit(e.target.value)}
      className={`h-10 w-full rounded-sm2 border border-line bg-input px-2 text-center font-semibold tabular-nums text-text placeholder:font-normal placeholder:text-faint focus:border-accent focus:outline-none ${className}`}
      {...rest}
    />
  );
}
