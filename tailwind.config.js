// Alle kleuren komen uit CSS-variabelen (src/index.css). color-mix maakt opacity-modifiers
// zoals bg-accent/15 mogelijk zonder losse kleurcodes in de componenten.
const token = (name) => `color-mix(in srgb, var(${name}) calc(<alpha-value> * 100%), transparent)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      screens: {
        // Vanaf 900px: zijbalk. Daaronder: onderste menu.
        desk: '900px',
      },
      colors: {
        bg: token('--bg'),
        surface: token('--surface'),
        'surface-2': token('--surface-2'),
        input: token('--input'),
        border: token('--line-2'),
        line: token('--line'),
        'line-2': token('--line-2'),
        text: token('--fg'),
        muted: token('--muted'),
        faint: token('--faint'),
        champ: token('--champ'),
        side: token('--side'),
        primary: token('--accent-soft'),
        'primary-soft': token('--accent-soft'),
        accent: token('--accent'),
        'accent-ink': token('--accent-fg'),
        pos: token('--pos'),
        danger: token('--neg'),
        warn: token('--warn'),
      },
      fontFamily: { sans: ['Inter Variable', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'] },
      borderRadius: { card: 'var(--r)', sm2: 'var(--r-sm)' },
      boxShadow: { soft: 'var(--shadow)', pop: 'var(--shadow-pop)', gold: 'var(--shadow-gold)' },
    },
  },
  plugins: [],
};
