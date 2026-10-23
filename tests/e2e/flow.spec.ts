import { expect, test } from '@playwright/test';
import { login } from './fixtures';

// Volledige gebruikersflow op een iPhone-viewport, in volgorde (één gedeelde browsercontext).
test.describe.configure({ mode: 'serial' });

const templateName = `E2E ${Date.now()}`;

test('volledige flow: login → template → workout → herstel → finish → history → meting → offline', async ({ page, context }) => {
  // 1. inloggen
  await login(page);

  // 2. template maken
  await page.goto('/templates/new');
  await page.getByPlaceholder('bv. Upper').fill(templateName);
  await page.getByRole('button', { name: 'Oefening toevoegen' }).click();
  await page.getByPlaceholder('Zoek oefening').fill('Bench Press (Dumbbell)');
  await page.getByRole('button', { name: /Bench Press \(Dumbbell\)/ }).click();
  await page.getByRole('button', { name: /Voeg 1 toe/ }).click();
  await page.getByRole('button', { name: 'Opslaan' }).click();
  await expect(page.getByText(templateName)).toBeVisible();

  // 3. workout starten
  await page.getByText(templateName).click();
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page.getByRole('button', { name: 'Finish' })).toBeVisible();

  // 4. sets loggen
  const kg = page.getByLabel('kg').first();
  await kg.fill('24');
  await page.getByLabel('Reps').first().fill('8');
  await page.getByRole('button', { name: 'Set afvinken' }).first().click();
  await expect(page.getByRole('button', { name: 'Set niet meer afgevinkt' })).toHaveCount(1);
  await expect(page.getByRole('timer')).toBeVisible(); // rustbalk

  // 5. refresh en herstel
  await page.reload();
  await expect(page.getByText('Workout bezig')).toBeVisible();
  await page.getByText('Hervatten').click();
  await expect(page.getByLabel('kg').first()).toHaveValue('24');

  // 6. Finish (ook dubbel tikken)
  await page.getByRole('button', { name: 'Finish' }).click();
  const save = page.getByRole('button', { name: 'Workout opslaan' });
  await save.dblclick();
  await expect(page).toHaveURL(/\/history\/.+finished=1/);
  const workoutUrl = page.url();

  // 7. terugvinden in History en kalender (precies één keer)
  await page.goto('/history');
  await expect(page.getByRole('link', { name: new RegExp(templateName) })).toHaveCount(1);
  await page.getByRole('tab', { name: 'Kalender' }).click();
  await expect(page.getByRole('link', { name: new RegExp(templateName) })).toHaveCount(1);

  // Server heeft ook precies één workout (na sync)
  await page.goto('/settings/sync');
  await page.getByRole('button', { name: 'Nu synchroniseren' }).click();
  await expect(page.getByText('Alles is verstuurd.')).toBeVisible({ timeout: 15_000 });

  // 8. meting toevoegen
  await page.goto('/measure');
  await page.getByRole('button', { name: 'Meting' }).click();
  await page.getByLabel(/Waarde/).fill('79,4');
  await page.getByRole('button', { name: 'Opslaan' }).click();
  await expect(page.getByText('79,4')).toBeVisible();

  // 9. offline openen
  await context.setOffline(true);
  await page.goto(workoutUrl);
  await expect(page.getByText('Workout opgeslagen')).toBeVisible();
  await expect(page.getByText(/Offline/)).toBeVisible();
  await context.setOffline(false);
});
