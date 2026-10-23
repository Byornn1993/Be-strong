import { defineConfig, devices } from '@playwright/test';

// E2E-tests draaien tegen een PRODUCTION build (vite preview), zodat ook de service worker en
// offline-modus getest worden, en tegen een LOKALE Supabase (`supabase start` + seed.sql).
// Zie README › Testen. Nooit tegen productie.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    serviceWorkers: 'allow',
  },
  projects: [{ name: 'iphone', use: { ...devices['iPhone 13'], browserName: 'chromium' } }],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
