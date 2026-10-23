import { expect, type Page } from '@playwright/test';

// Testgebruikers uit supabase/seed.sql — bestaan ALLEEN in de lokale Supabase.
export const USER_A = { email: 'test-a@bestrong.test', password: 'test-password-a' };

export async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(USER_A.email);
  await page.getByLabel('Wachtwoord').fill(USER_A.password);
  await page.getByRole('button', { name: 'Inloggen' }).click();
  await expect(page.getByRole('heading', { name: 'Profiel' })).toBeVisible();
}
