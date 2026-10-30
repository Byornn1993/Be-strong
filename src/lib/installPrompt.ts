// Chrome/Edge sturen "beforeinstallprompt" één keer, vroeg na het laden. We vangen het hier al op
// (geïmporteerd in main.tsx), zodat de installeerknop in Instellingen het later nog kan gebruiken.

export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e as InstallPromptEvent;
  for (const l of listeners) l();
});

export const getInstallPrompt = () => deferred;
export const clearInstallPrompt = () => {
  deferred = null;
};
export function onInstallPrompt(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
