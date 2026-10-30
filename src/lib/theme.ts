import { useSyncExternalStore } from 'react';

// Thema per toestel (localStorage). Standaard: donker.
// Volgorde bij elke tik: automatisch → licht → donker → automatisch …
// Het inline script in index.html past dezelfde logica toe vóór de eerste render (geen witte flits).

export type ThemeChoice = 'auto' | 'light' | 'dark';

const KEY = 'bestrong-theme';
const listeners = new Set<() => void>();

export function getTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'auto' || v === 'light' || v === 'dark' ? v : 'dark';
  } catch {
    return 'dark';
  }
}

export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
  const isLight = choice === 'light' || (choice === 'auto' && window.matchMedia('(prefers-color-scheme: light)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isLight ? '#F6F1E8' : '#101418');
}

export function setTheme(choice: ThemeChoice): void {
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    /* privé-modus: keuze geldt enkel voor deze sessie */
  }
  applyTheme(choice);
  for (const l of listeners) l();
}

export function nextTheme(choice: ThemeChoice): ThemeChoice {
  return choice === 'auto' ? 'light' : choice === 'light' ? 'dark' : 'auto';
}

export const THEME_LABEL: Record<ThemeChoice, string> = {
  dark: 'Thema: donker',
  light: 'Thema: licht',
  auto: 'Thema: automatisch',
};

export function useTheme(): ThemeChoice {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getTheme,
  );
}
